import copy
import http.client
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import ListStore, InvalidList, create_server, normalize_list


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.store = ListStore(self.root)
        self.value = normalize_list({"id": "csv-test", "name": "Bài 26", "type": "Theo bài",
                                     "words": [{"hiragana": "かな", "kanji": "字", "hanViet": "ÂM", "meaning": "nghĩa"}]})

    def tearDown(self):
        self.directory.cleanup()

    def test_parser_preserves_source_and_normalizes_quoted_line_endings(self):
        value = copy.deepcopy(self.value)
        value["words"][0]["meaning"] = "nghĩa\nxuống dòng"
        text = '\ufeffかな,  "字 | ÂM | nghĩa\r\nxuống dòng"  \r\n'
        value["csv"] = {"filename": "test.csv", "text": text}
        normalized = normalize_list(value)
        self.store.add(normalized)
        self.assertEqual(ListStore(self.root).read(), [normalized])
        self.assertEqual((self.store.root / "csv-test/vocabulary.csv").read_bytes(), text.encode("utf-8"))

    def test_bom_whitespace_matches_browser_parser(self):
        text = '\ufeff\ufeffかな,\ufeff "字 | ÂM | nghĩa" \ufeff\r\n'
        value = {**self.value, "csv": {"filename": "bom.csv", "text": text}}
        self.assertEqual(normalize_list(value), value)

    def test_atomic_failure_and_restart(self):
        with patch("server.os.fsync", side_effect=OSError("full")):
            with self.assertRaises(OSError):
                self.store.add(self.value)
        self.assertEqual(self.store.read(), [])
        self.assertEqual(list(self.store.root.iterdir()), [])
        self.store.add(self.value)
        self.assertEqual(ListStore(self.root).read(), [self.value])
        self.assertEqual(self.store.add(self.value), [self.value])

    def test_legacy_synthesis_duplicates_and_corrupt_metadata(self):
        self.store.add(self.value)
        value = copy.deepcopy(self.value)
        value.update(id="csv-other", name="Ｂài-26.")
        with self.assertRaises(FileExistsError):
            self.store.add(value)
        (self.store.root / "csv-test/list.json").write_text("[]", encoding="utf-8")
        with self.assertRaises(OSError):
            self.store.read()

    def test_rejects_malformed_csv_and_symlink_files(self):
        for text in ['か"な,字 | ÂM | nghĩa', 'かな,"字 | ÂM | nghĩa"junk', 'かな,"未完']:
            value = {**self.value, "csv": {"filename": "bad.csv", "text": text}}
            with self.assertRaises(InvalidList):
                normalize_list(value)
        self.store.add(self.value)
        source = self.store.root / "csv-test/vocabulary.csv"
        source.unlink()
        source.symlink_to(self.root / "outside")
        with self.assertRaises(OSError):
            self.store.read()


class HTTPContractTests:
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.start()
        self.value = {
            "id": "csv-abc123", "name": "Bài 26", "type": "Theo bài",
            "words": [{"hiragana": "みます", "kanji": "見ます", "hanViet": "KIẾN", "meaning": "xem, nhìn"}],
            "csv": {"filename": "từ vựng.csv", "text": '\ufeffみます,"見ます | KIẾN | xem, nhìn"\r\n'},
        }

    def start(self):
        self.server = create_server(self.root, port=0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def stop(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def tearDown(self):
        self.stop()
        self.directory.cleanup()

    def request(self, value=None, headers=None, path="/api/imported-lists"):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port)
        body = json.dumps(value, ensure_ascii=False).encode("utf-8") if value is not None else None
        connection.request("POST" if value is not None else "GET", path, body,
                           headers or ({"Content-Type": "application/json"} if body else {}))
        response = connection.getresponse()
        status, content_type, payload = response.status, response.getheader("Content-Type"), response.read()
        connection.close()
        self.assertIn("application/json", content_type)
        return status, json.loads(payload)

    def test_exact_source_survives_restart_and_repeat_import(self):
        self.assertEqual(self.request(), (200, {"version": 1, "lists": []}))
        status, saved = self.request(self.value)
        self.assertEqual(status, 200)
        self.assertEqual(saved["lists"], [self.value])
        self.assertEqual((self.root / "imported-lists/csv-abc123/vocabulary.csv").read_bytes(), self.value["csv"]["text"].encode("utf-8"))
        self.stop()
        self.start()
        self.assertEqual(self.request(), (200, saved))
        self.assertEqual(self.request(self.value), (200, saved))
        legacy = {key: value for key, value in self.value.items() if key != "csv"}
        self.assertEqual(self.request(legacy), (200, saved))

    def test_legacy_synthesis_and_complete_registry(self):
        self.assertEqual(self.request(self.value)[0], 200)
        legacy = copy.deepcopy(self.value)
        legacy.pop("csv")
        legacy.update(id="csv-legacy", name="Bài 27")
        status, saved = self.request(legacy)
        self.assertEqual(status, 200)
        self.assertEqual(len(saved["lists"]), 2)
        source = saved["lists"][1]["csv"]["text"]
        self.assertEqual(source, '"みます","見ます | KIẾN | xem, nhìn"\n')
        self.assertEqual(self.request()[1], saved)

    def test_conflicts_do_not_overwrite_existing_source(self):
        self.request(self.value)
        conflicting = copy.deepcopy(self.value)
        conflicting["name"] = "Changed"
        self.assertEqual(self.request(conflicting)[0], 409)
        conflicting = copy.deepcopy(self.value)
        conflicting["id"] = "csv-another"
        self.assertEqual(self.request(conflicting)[0], 409)
        self.assertEqual(self.request()[1]["lists"], [self.value])

    def test_invalid_payloads_do_not_publish(self):
        for field, invalid in [("id", "csv-../../escape"), ("name", ""), ("type", " "), ("words", []),
                               ("csv", {"filename": "bad.csv", "text": "not,csv"})]:
            with self.subTest(field=field):
                value = {**self.value, field: invalid}
                self.assertEqual(self.request(value)[0], 400)
        value = copy.deepcopy(self.value)
        value["csv"]["text"] += " " * (2 * 1024 * 1024)
        self.assertEqual(self.request(value)[0], 400)
        self.assertEqual(self.request()[1]["lists"], [])

    def test_disk_failure_is_atomic(self):
        with patch("server.os.fsync", side_effect=OSError("disk full")):
            self.assertEqual(self.request(self.value)[0], 500)
        self.assertEqual(self.request()[1]["lists"], [])
        self.assertEqual(list((self.root / "imported-lists").iterdir()), [])
        self.assertEqual(self.request(self.value)[0], 200)

    def test_foreign_origin_host_and_non_json_are_rejected(self):
        headers = {"Content-Type": "application/json", "Origin": "https://foreign.example"}
        self.assertEqual(self.request(self.value, headers)[0], 403)
        self.assertEqual(self.request(headers={"Host": "foreign.example"})[0], 403)
        self.assertEqual(self.request(self.value, {"Content-Type": "text/plain"})[0], 415)
        self.assertEqual(self.request()[1]["lists"], [])

    def test_storage_symlink_is_rejected(self):
        outside = self.root / "outside"
        outside.mkdir()
        (self.root / "imported-lists").symlink_to(outside, target_is_directory=True)
        self.assertEqual(self.request()[0], 500)
        self.assertEqual(self.request(self.value)[0], 500)
        self.assertEqual(list(outside.iterdir()), [])


@unittest.skipUnless(os.environ.get("NIHONGO_HTTP_TESTS") == "1", "Set NIHONGO_HTTP_TESTS=1 to run loopback HTTP tests")
class NetworkServerTests(HTTPContractTests, unittest.TestCase):
    pass


class InMemoryServerTests(HTTPContractTests, unittest.TestCase):
    """Exercise request parsing and handlers without opening any socket."""

    def start(self):
        def memory_server(address, handler):
            return SimpleNamespace(server_port=4173, RequestHandlerClass=handler)
        with patch("server.ThreadingHTTPServer", side_effect=memory_server):
            self.server = create_server(self.root, port=4173)

    def stop(self):
        pass

    def request(self, value=None, headers=None, path="/api/imported-lists"):
        body = json.dumps(value, ensure_ascii=False).encode("utf-8") if value is not None else b""
        headers = dict(headers or ({"Content-Type": "application/json"} if body else {}))
        headers.setdefault("Host", "127.0.0.1:4173")
        if body:
            headers["Content-Length"] = str(len(body))
        method = "POST" if value is not None else "GET"
        head = f"{method} {path} HTTP/1.1\r\n" + "".join(f"{key}: {item}\r\n" for key, item in headers.items()) + "\r\n"

        class MemoryConnection:
            def __init__(self, data):
                self.incoming = io.BytesIO(data)
                self.outgoing = bytearray()

            def makefile(self, mode, buffering=None):
                return self.incoming

            def sendall(self, data):
                self.outgoing.extend(data)

        connection = MemoryConnection(head.encode("ascii") + body)
        handler = self.server.RequestHandlerClass
        with patch.object(handler, "log_message", return_value=None):
            handler(connection, ("127.0.0.1", 12345), self.server)
        response = http.client.HTTPResponse(MemoryConnection(bytes(connection.outgoing)))
        response.begin()
        self.assertIn("application/json", response.getheader("Content-Type"))
        return response.status, json.loads(response.read())


if __name__ == "__main__":
    unittest.main()
