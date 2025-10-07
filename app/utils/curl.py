from __future__ import annotations

import json
import shlex
from typing import Any, Dict, Tuple


def parse_curl_command(command: str) -> Tuple[str, Dict[str, Any]]:
    tokens = shlex.split(command)
    if not tokens or tokens[0] != "curl":
        raise ValueError("CURL command must start with 'curl'")

    method = "GET"
    url = ""
    headers: Dict[str, str] = {}
    data: str | None = None

    iterator = iter(tokens[1:])
    for token in iterator:
        if token in {"-X", "--request"}:
            method = next(iterator, method).upper()
        elif token in {"-H", "--header"}:
            header_value = next(iterator, "")
            if ":" in header_value:
                key, value = header_value.split(":", 1)
                headers[key.strip()] = value.strip()
        elif token in {"-d", "--data", "--data-raw", "--data-binary"}:
            data = next(iterator, None)
        elif token.startswith("http://") or token.startswith("https://"):
            url = token

    if not url:
        # Attempt to find URL from last token
        url = tokens[-1]

    payload: Dict[str, Any] = {
        "method": method,
        "url": url,
        "headers": headers,
    }
    if data is not None:
        try:
            payload["json"] = json.loads(data)
        except json.JSONDecodeError:
            payload["data"] = data

    return method, payload
