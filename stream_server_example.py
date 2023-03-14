from asyncio import Future, get_event_loop, create_subprocess_exec
from datetime import datetime
from os.path import join
from subprocess import PIPE, DEVNULL

from websockets import serve
from websockets.exceptions import ConnectionClosedError
from websockets.legacy.server import WebSocketServerProtocol

RECORDING_PATH = "."


async def handle_client(ws: WebSocketServerProtocol):
    date = datetime.now().strftime("%d%m%Y_%H%M%S")
    args = [
        "ffmpeg",
        "-i",
        "-",  # Pipe
        "-filter:v",
        "fps=fps=60",
        "-preset",
        "veryfast",
        join(RECORDING_PATH, f"{date}.mp4")
    ]
    process = await create_subprocess_exec(*args, stdin=PIPE, stdout=DEVNULL, stderr=DEVNULL)
    stdin = process.stdin

    fp = open(join(RECORDING_PATH, f"{date}.webm"), "wb") # Also, write webm stream to file

    while ws.open:
        try:
            data = await ws.recv()
        except ConnectionClosedError:
            break
        if data:
            stdin.write(data)
            await stdin.drain()
            fp.write(data)

    fp.close()

    stdin.close()
    await process.wait()


async def main():
    async with serve(handle_client, "localhost", 12345):
        await Future() # Run forever


if __name__ == "__main__":
    get_event_loop().run_until_complete(main())
