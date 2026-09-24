#!/usr/bin/env python3
"""Local app server with durable personal CSV lists. No external dependencies."""
import argparse
import csv
import io
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
import threading
import unicodedata
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

MAX_BODY = 16 * 1024 * 1024
MAX_CSV = 2 * 1024 * 1024
FIELDS = ("hiragana", "kanji", "hanViet", "meaning")


def name_key(value):
    return re.sub(r"[\s\-・.]", "", unicodedata.normalize("NFKC", value)).lower()


class InvalidList(ValueError):
    pass


def trim_csv(value):
    # JavaScript trim also treats the BOM character as whitespace.
    return re.sub(r"^[\s\ufeff]+|[\s\ufeff]+$", "", value)


def parse_rows(text):
    rows, row, field = [], [], ""
    quoted = closed = False
    text = text.removeprefix("\ufeff")
    index = 0
    while index < len(text):
        char = text[index]
        if quoted:
            if char == '"':
                if index + 1 < len(text) and text[index + 1] == '"':
                    field += '"'
                    index += 1
                else:
                    quoted, closed = False, True
            elif char in "\r\n":
                if char == "\r" and text[index:index + 2] == "\r\n":
                    index += 1
                field += "\n"
            else:
                field += char
        elif char in ",\r\n":
            row.append(trim_csv(field))
            field, closed = "", False
            if char != ",":
                if any(row):
                    rows.append(row)
                row = []
                if char == "\r" and text[index:index + 2] == "\r\n":
                    index += 1
        elif char == '"':
            if closed or trim_csv(field):
                raise InvalidList("Dấu ngoặc kép CSV không hợp lệ.")
            field, quoted = "", True
        else:
            if closed and trim_csv(char):
                raise InvalidList("Dấu ngoặc kép CSV không hợp lệ.")
            field += char
        index += 1
    if quoted:
        raise InvalidList("Dấu ngoặc kép CSV chưa đóng.")
    row.append(trim_csv(field))
    if any(row):
        rows.append(row)
    return rows


def normalize_list(value):
    if not isinstance(value, dict):
        raise InvalidList("Danh sách không hợp lệ.")
    identifier = value.get("id")
    name, kind, words = value.get("name"), value.get("type", "Chưa phân loại"), value.get("words")
    if not isinstance(identifier, str) or not re.fullmatch(r"csv-[a-z0-9-]+", identifier) or len(identifier) > 100:
        raise InvalidList("ID danh sách không hợp lệ.")
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
        raise InvalidList("Tên danh sách phải có từ 1 đến 80 ký tự.")
    if not isinstance(kind, str):
        raise InvalidList("Loại danh sách không hợp lệ.")
    kind = " ".join(unicodedata.normalize("NFKC", kind).split())
    if not 1 <= len(kind) <= 50:
        raise InvalidList("Loại danh sách phải có từ 1 đến 50 ký tự.")
    if not isinstance(words, list) or not 1 <= len(words) <= 5000:
        raise InvalidList("Danh sách phải có từ 1 đến 5.000 từ.")
    clean_words = []
    for word in words:
        if not isinstance(word, dict) or any(not isinstance(word.get(key), str) for key in FIELDS):
            raise InvalidList("Từ vựng không hợp lệ.")
        if not word["hiragana"].strip() or not word["meaning"].strip():
            raise InvalidList("Từ vựng thiếu cách đọc hoặc nghĩa.")
        clean_words.append({key: word[key] for key in FIELDS})
    source = value.get("csv")
    if source is None:
        output = io.StringIO(newline="")
        writer = csv.writer(output, quoting=csv.QUOTE_ALL, lineterminator="\n")
        for word in clean_words:
            writer.writerow([word["hiragana"], " | ".join(word[key] for key in FIELDS[1:])])
        source = {"filename": "vocabulary.csv", "text": output.getvalue()}
    if not isinstance(source, dict) or not isinstance(source.get("text"), str) or not isinstance(source.get("filename"), str):
        raise InvalidList("File CSV không hợp lệ.")
    if not source["filename"] or len(source["filename"]) > 255:
        raise InvalidList("Tên file CSV không hợp lệ.")
    try:
        if len(source["text"].encode("utf-8")) > MAX_CSV:
            raise InvalidList("File CSV vượt quá 2 MB.")
        parsed = []
        for row in parse_rows(source["text"]):
            if len(row) != 2:
                raise InvalidList("File CSV phải có đúng 2 cột.")
            parts = [trim_csv(part) for part in row[1].split("|")]
            if len(parts) != 3:
                raise InvalidList("File CSV không đúng định dạng.")
            parts[:2] = ["" if re.fullmatch(r"[-–—]+", part) else part for part in parts[:2]]
            parsed.append(dict(zip(FIELDS, [row[0], *parts])))
        if parsed != clean_words:
            raise InvalidList("Nội dung CSV không khớp danh sách từ vựng.")
    except UnicodeError as error:
        raise InvalidList("File CSV UTF-8 không hợp lệ.") from error
    result = {"id": identifier, "name": name.strip(), "type": kind, "words": clean_words,
              "csv": {"filename": source["filename"], "text": source["text"]}}
    try:
        json.dumps(result, ensure_ascii=False).encode("utf-8")
    except UnicodeError as error:
        raise InvalidList("Dữ liệu UTF-8 không hợp lệ.") from error
    return result


class ListStore:
    def __init__(self, directory):
        self.root = Path(directory).resolve() / "imported-lists"
        self.lock = threading.Lock()

    def check_root(self):
        if self.root.is_symlink():
            raise OSError("Unsafe storage path")
        self.root.mkdir(exist_ok=True)

    def read(self):
        self.check_root()
        lists = []
        for folder in sorted(self.root.glob("csv-*")):
            if folder.is_symlink() or not folder.is_dir():
                raise OSError("Unsafe list path")
            metadata, source = folder / "list.json", folder / "vocabulary.csv"
            if metadata.is_symlink() or source.is_symlink():
                raise OSError("Unsafe list files")
            try:
                value = json.loads(metadata.read_text(encoding="utf-8"))
                with source.open("r", encoding="utf-8", newline="") as stream:
                    value["csv"]["text"] = stream.read()
                value = normalize_list(value)
                if value["id"] != folder.name:
                    raise InvalidList("Stored ID mismatch")
                lists.append(value)
            except (ValueError, KeyError, TypeError) as error:
                raise OSError("Invalid stored list") from error
        return lists

    def add(self, value):
        with self.lock:
            lists = self.read()
            for existing in lists:
                if existing["id"] == value["id"]:
                    if all(existing[key] == value[key] for key in ("id", "name", "type", "words")):
                        return lists
                    raise FileExistsError("ID danh sách đã tồn tại với nội dung khác.")
                if name_key(existing["name"]) == name_key(value["name"]) and existing["type"].lower() == value["type"].lower():
                    raise FileExistsError("Tên danh sách đã tồn tại trong loại này.")
            staging = Path(tempfile.mkdtemp(prefix=".pending-", dir=self.root))
            try:
                metadata = {**value, "csv": {"filename": value["csv"]["filename"]}}
                for filename, content in (("vocabulary.csv", value["csv"]["text"]), ("list.json", json.dumps(metadata, ensure_ascii=False))):
                    with (staging / filename).open("w", encoding="utf-8", newline="") as stream:
                        stream.write(content)
                        stream.flush()
                        os.fsync(stream.fileno())
                staging.rename(self.root / value["id"])
            finally:
                if staging.exists():
                    shutil.rmtree(staging)
            return [*lists, value]


def create_server(directory, host="127.0.0.1", port=4173):
    root = Path(directory).resolve()
    store = ListStore(root)

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

        def respond(self, status, value):
            body = json.dumps(value, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def allowed(self):
            host_header = self.headers.get("Host", "")
            allowed_hosts = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
            origin = self.headers.get("Origin")
            return host_header in allowed_hosts and (origin is None or origin == f"http://{host_header}")

        def do_HEAD(self):
            target = Path(self.translate_path(self.path))
            if not self.allowed() or not target.resolve().is_relative_to(root) or any(path.is_symlink() for path in [target, *target.parents]):
                self.send_error(403)
                return
            super().do_HEAD()

        def do_GET(self):
            if not self.allowed():
                self.respond(403, {"error": "Nguồn truy cập không được phép."})
                return
            if urlsplit(self.path).path == "/api/imported-lists":
                try:
                    with store.lock:
                        lists = store.read()
                    self.respond(200, {"version": 1, "lists": lists})
                except (OSError, ValueError, KeyError):
                    self.respond(500, {"error": "Không thể đọc danh sách đã lưu trên máy."})
                return
            target = Path(self.translate_path(self.path))
            if not target.resolve().is_relative_to(root) or any(path.is_symlink() for path in [target, *target.parents] if path != root.parent):
                self.respond(403, {"error": "Đường dẫn không được phép."})
                return
            super().do_GET()

        def do_POST(self):
            if not self.allowed():
                self.respond(403, {"error": "Nguồn truy cập không được phép."})
                return
            if urlsplit(self.path).path != "/api/imported-lists":
                self.respond(404, {"error": "Không tìm thấy API."})
                return
            if self.headers.get_content_type() != "application/json":
                self.respond(415, {"error": "Yêu cầu phải dùng application/json."})
                return
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= MAX_BODY or self.headers.get("Transfer-Encoding"):
                    raise InvalidList("Dung lượng yêu cầu không hợp lệ.")
                value = normalize_list(json.loads(self.rfile.read(size).decode("utf-8")))
                lists = store.add(value)
                self.respond(200, {"version": 1, "lists": lists})
            except FileExistsError as error:
                self.respond(409, {"error": str(error)})
            except (ValueError, UnicodeError) as error:
                self.respond(400, {"error": str(error)})
            except OSError:
                self.respond(500, {"error": "Không thể lưu file CSV trên máy. Hãy kiểm tra dung lượng và quyền ghi."})

    server = ThreadingHTTPServer((host, port), Handler)
    server.store = store
    return server


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("port", type=int, nargs="?", default=4173)
    args = parser.parse_args()
    with create_server(Path(__file__).parent, port=args.port) as server:
        print(f"Nihongo: http://127.0.0.1:{server.server_port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
