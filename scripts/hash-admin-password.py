#!/usr/bin/env python3
"""Print the SHA-256 hash used by the site admin login."""

import hashlib
import sys


def main() -> int:
    if len(sys.argv) != 2 or not sys.argv[1]:
        print('Usage: python3 scripts/hash-admin-password.py "your-password"', file=sys.stderr)
        return 1
    digest = hashlib.sha256(sys.argv[1].encode('utf-8')).hexdigest()
    print(digest)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
