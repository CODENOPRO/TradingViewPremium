"""Serve the frontend and music link endpoints locally, without the market bridge."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
import webbrowser

from backend.companion_services import MusicProviderError, music_metadata, resolve_music_share


class PreviewHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        request = urlsplit(self.path)
        if request.path not in ('/api/music/resolve', '/api/music/metadata'):
            return super().do_GET()

        params = parse_qs(request.query)
        url = params.get('url', [''])[0]
        try:
            if len(url) > 2048:
                raise ValueError('Link too long')
            data = ({'url': resolve_music_share(url)} if request.path.endswith('/resolve')
                    else music_metadata(url, fresh_embed=params.get('embed') == ['1']))
            status = 200
        except MusicProviderError as error:
            status, data = error.status, {'error': str(error)}
        except ValueError as error:
            status, data = 400, {'error': str(error)}
        except OSError:
            status, data = 502, {'error': 'Provider unavailable. Try the full link.'}

        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def log_request(self, code='-', size='-'):
        self.log_message('%s %s %s', self.command, urlsplit(self.path).path, code)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=4175)
    parser.add_argument('--open', action='store_true', help='Open the preview in the default browser')
    args = parser.parse_args()
    frontend = Path(__file__).resolve().parent / 'frontend'
    handler = partial(PreviewHandler, directory=str(frontend))
    with ThreadingHTTPServer(('127.0.0.1', args.port), handler) as server:
        address = f'http://127.0.0.1:{server.server_port}/'
        print(f'Trading Terminal Music Preview: {address}', flush=True)
        if args.open:
            webbrowser.open(address)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
