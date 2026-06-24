# Data Center Server Map

This is a simple beginner-friendly web app for visualizing and editing a small server network.

Open `index.html` in a browser, or run a local static server from this folder:

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
