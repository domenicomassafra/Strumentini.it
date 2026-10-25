#!/usr/bin/env python3
"""Forward ADB commands to the existing MiniPC emulator, with the build on Studio."""
import shlex
import subprocess
import sys

remote = "/home/udodo/Android/Sdk/platform-tools/adb"
args = sys.argv[1:]
if args and args[0] == "push":
    subprocess.run(["scp", "-q", args[1], "minipc:/tmp/str461-source.png"], check=True)
    args[1] = "/tmp/str461-source.png"
if args and args[0] == "pull":
    remote_file = "/tmp/str461-android-pulled.jpg"
    subprocess.run(["ssh", "-o", "BatchMode=yes", "minipc", shlex.join([remote, "pull", args[1], remote_file])], check=True, stdout=subprocess.PIPE)
    subprocess.run(["scp", "-q", "minipc:" + remote_file, args[2]], check=True)
    sys.stdout.write("1 file pulled\n")
else:
    command = shlex.join([remote, *args])
    result = subprocess.run(["ssh", "-o", "BatchMode=yes", "minipc", command], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    sys.stdout.buffer.write(result.stdout)
    sys.stderr.buffer.write(result.stderr)
    sys.exit(result.returncode)
