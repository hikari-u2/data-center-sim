# Data Center Server Map

This is a simple beginner-friendly web app for visualizing and editing a small server network.

## Run On Windows

For non-technical users, double-click:

```text
Start Data Center Sim.bat
```

It starts a local server and opens the app in the browser at:

```text
http://localhost:8080/
```

Keep the black terminal window open while using the app. Press `Ctrl+C` in that window to stop it.

## Other Ways To Run

You can also open `index.html` directly in a browser.

If Python is installed, you can run a local static server from this folder:

```bash
python3 -m http.server 5173
```

The sample server, VM, and network connection data lives in `app.js`.

Each server shows:

- Name
- CPU
- RAM
- Storage
- GPUs
- VMs loaded on that server

VM cards can be dragged onto a server.

You can also:

- Add a server with name, CPU, RAM, storage, and GPUs
- Click a server to read and edit its details
- Save changes to update a selected server
- Delete a selected server and remove its network links
- Drag devices around the topology canvas
- Use **Join Devices** and select two devices to connect them
