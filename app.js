const DEFAULT_CONFIG = {
  servers: [
    {
      id: "edge-01",
      name: "Edge-01",
      status: "Online",
      cpu: "16 vCPU",
      ram: "64 GB",
      storage: "2 TB NVMe",
      gpus: "1 x NVIDIA A10",
      vmIds: ["vm-web"],
      x: 58,
      y: 8,
    },
    {
      id: "compute-02",
      name: "Compute-02",
      status: "Online",
      cpu: "32 vCPU",
      ram: "128 GB",
      storage: "4 TB SSD",
      gpus: "2 x NVIDIA L40S",
      vmIds: [],
      x: 64,
      y: 40,
    },
    {
      id: "storage-03",
      name: "Storage-03",
      status: "Online",
      cpu: "12 vCPU",
      ram: "96 GB",
      storage: "24 TB HDD",
      gpus: "None",
      vmIds: ["vm-db"],
      x: 58,
      y: 72,
    },
  ],
  infrastructureNodes: [
    { id: "desktop", type: "desktop", name: "Admin Desktop", x: 8, y: 42 },
    { id: "switch", type: "switch", name: "Core Switch", x: 34, y: 43 },
  ],
  links: [
    { from: "desktop", to: "switch" },
    { from: "switch", to: "edge-01" },
    { from: "switch", to: "compute-02" },
    { from: "switch", to: "storage-03" },
  ],
  vms: [
    { id: "vm-web", name: "web-01", size: "2 CPU / 4 GB" },
    { id: "vm-db", name: "db-01", size: "4 CPU / 16 GB" },
    { id: "vm-test", name: "test-lab", size: "2 CPU / 8 GB" },
    { id: "vm-gpu", name: "ai-worker", size: "8 CPU / 32 GB / GPU" },
    { id: "vm-backup", name: "backup-01", size: "2 CPU / 8 GB" },
  ],
};

const CONFIG_API_URL = "/api/config";
const CONFIG_FILE_URL = "data/config.json";

let servers = [];
let infrastructureNodes = [];
let links = [];
let vms = [];

const topologyCanvas = document.querySelector("#topology-canvas");
const nodeLayer = document.querySelector("#node-layer");
const linkLayer = document.querySelector("#link-layer");
const vmPool = document.querySelector("#vm-pool");
const serverForm = document.querySelector("#server-form");
const serverFormState = document.querySelector("#server-form-state");
const serverSubmit = document.querySelector("#server-submit");
const newServerButton = document.querySelector("#new-server");
const deleteServerButton = document.querySelector("#delete-server");
const serverCount = document.querySelector("#server-count");
const linkCount = document.querySelector("#link-count");
const vmCount = document.querySelector("#vm-count");
const joinToggle = document.querySelector("#join-toggle");
const clearSelection = document.querySelector("#clear-selection");
const joinHelp = document.querySelector("#join-help");

let joinMode = false;
let selectedNodeId = null;
let selectedServerId = null;
let dragging = null;
let suppressedClickNodeId = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeConfig(config) {
  const fallback = clone(DEFAULT_CONFIG);
  const safeConfig = config && typeof config === "object" ? config : fallback;

  return {
    servers: Array.isArray(safeConfig.servers) ? safeConfig.servers : fallback.servers,
    infrastructureNodes: Array.isArray(safeConfig.infrastructureNodes)
      ? safeConfig.infrastructureNodes
      : fallback.infrastructureNodes,
    links: Array.isArray(safeConfig.links) ? safeConfig.links : fallback.links,
    vms: Array.isArray(safeConfig.vms) ? safeConfig.vms : fallback.vms,
  };
}

function applyConfig(config) {
  const normalized = normalizeConfig(config);
  servers = clone(normalized.servers);
  infrastructureNodes = clone(normalized.infrastructureNodes);
  links = clone(normalized.links);
  vms = clone(normalized.vms);
}

function serializeConfig() {
  return {
    servers,
    infrastructureNodes,
    links,
    vms,
  };
}

async function loadConfig() {
  for (const url of [CONFIG_API_URL, CONFIG_FILE_URL]) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        applyConfig(await response.json());
        return;
      }
    } catch {
      // Continue to the next source.
    }
  }

  applyConfig(DEFAULT_CONFIG);
}

async function saveConfig() {
  try {
    const response = await fetch(CONFIG_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serializeConfig(), null, 2),
    });

    if (!response.ok) {
      throw new Error("Config save failed");
    }
  } catch (error) {
    console.warn("Config could not be saved to data/config.json. Run the app with serve-local.ps1.", error);
  }
}

function getAllNodes() {
  return [...infrastructureNodes, ...servers.map((server) => ({ ...server, type: "server" }))];
}

function getNode(id) {
  return getAllNodes().find((node) => node.id === id);
}

function getServer(id) {
  return servers.find((server) => server.id === id);
}

function getAssignedVmIds() {
  return new Set(servers.flatMap((server) => server.vmIds));
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getNextServerName() {
  return `Compute-${String(servers.length + 1).padStart(2, "0")}`;
}

function getNextServerPosition() {
  const serverIndex = servers.length;
  const columns = [56, 72];
  const rows = [8, 38, 68];

  return {
    x: columns[serverIndex % columns.length],
    y: rows[Math.floor(serverIndex / columns.length) % rows.length],
  };
}

function getServerFormData() {
  const formData = new FormData(serverForm);

  return {
    name: String(formData.get("name")).trim(),
    cpu: String(formData.get("cpu")).trim(),
    ram: String(formData.get("ram")).trim(),
    storage: String(formData.get("storage")).trim(),
    gpus: String(formData.get("gpus")).trim(),
  };
}

function fillServerForm(server) {
  serverForm.elements.name.value = server.name;
  serverForm.elements.cpu.value = server.cpu;
  serverForm.elements.ram.value = server.ram;
  serverForm.elements.storage.value = server.storage;
  serverForm.elements.gpus.value = server.gpus;
}

function resetServerForm() {
  selectedServerId = null;
  selectedNodeId = null;
  joinMode = false;
  serverForm.elements.name.value = getNextServerName();
  serverForm.elements.cpu.value = "24 vCPU";
  serverForm.elements.ram.value = "96 GB";
  serverForm.elements.storage.value = "3 TB SSD";
  serverForm.elements.gpus.value = "None";
  render();
}

function selectServerForEdit(serverId) {
  const server = getServer(serverId);
  if (!server) {
    return;
  }

  selectedServerId = serverId;
  selectedNodeId = null;
  joinMode = false;
  fillServerForm(server);
  render();
}

function makeVmCard(vm) {
  const card = document.createElement("div");
  card.className = "vm-card";
  card.draggable = true;
  card.dataset.vmId = vm.id;
  card.innerHTML = `<strong>${escapeHtml(vm.name)}</strong><span>${escapeHtml(vm.size)}</span>`;
  card.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", vm.id);
    event.dataTransfer.effectAllowed = "move";
  });
  return card;
}

function moveVmToServer(vmId, serverId) {
  servers.forEach((server) => {
    server.vmIds = server.vmIds.filter((id) => id !== vmId);
  });

  if (serverId !== "pool") {
    const targetServer = getServer(serverId);
    if (targetServer) {
      targetServer.vmIds.push(vmId);
    }
  }

  render();
  saveConfig();
}

function attachDropZone(element, serverId) {
  element.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    element.closest(".topology-node")?.classList.add("is-drop-target");
  });

  element.addEventListener("dragleave", () => {
    element.closest(".topology-node")?.classList.remove("is-drop-target");
  });

  element.addEventListener("drop", (event) => {
    event.preventDefault();
    const vmId = event.dataTransfer.getData("text/plain");
    element.closest(".topology-node")?.classList.remove("is-drop-target");
    moveVmToServer(vmId, serverId);
  });
}

function makeNodeElement(node) {
  const element = document.createElement("article");
  element.className = `topology-node ${node.type}-topology`;
  element.dataset.nodeId = node.id;
  element.style.left = `${node.x}%`;
  element.style.top = `${node.y}%`;

  if (node.id === selectedNodeId) {
    element.classList.add("is-selected");
  }

  if (node.id === selectedServerId) {
    element.classList.add("is-editing");
  }

  if (node.type === "server") {
    const server = getServer(node.id);
    element.innerHTML = `
      <div class="mini-rack" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="node-content">
        <div class="node-title">
          <span>Server</span>
          <strong>${escapeHtml(server.name)}</strong>
        </div>
        <div class="compact-specs">
          <span>${escapeHtml(server.cpu)}</span>
          <span>${escapeHtml(server.ram)}</span>
          <span>${escapeHtml(server.storage)}</span>
          <span>${escapeHtml(server.gpus)}</span>
        </div>
        <div class="vm-bay" aria-label="VMs loaded on ${escapeHtml(server.name)}"></div>
      </div>
    `;

    const bay = element.querySelector(".vm-bay");
    attachDropZone(bay, server.id);
    server.vmIds.forEach((vmId) => {
      const vm = vms.find((item) => item.id === vmId);
      if (vm) {
        bay.appendChild(makeVmCard(vm));
      }
    });
  } else if (node.type === "switch") {
    element.innerHTML = `
      <div class="switch-face" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="node-title">
        <span>Network</span>
        <strong>${escapeHtml(node.name)}</strong>
      </div>
    `;
  } else {
    element.innerHTML = `
      <div class="desktop-icon" aria-hidden="true">
        <span class="desktop-screen"></span>
        <span class="desktop-base"></span>
      </div>
      <div class="node-title">
        <span>Desktop</span>
        <strong>${escapeHtml(node.name)}</strong>
      </div>
    `;
  }

  element.addEventListener("pointerdown", startDrag);
  element.addEventListener("click", () => handleNodeClick(node.id));
  return element;
}

function startDrag(event) {
  if (event.button !== 0 || event.target.closest(".vm-card")) {
    return;
  }

  const nodeId = event.currentTarget.dataset.nodeId;
  const rect = topologyCanvas.getBoundingClientRect();
  const nodeRect = event.currentTarget.getBoundingClientRect();

  dragging = {
    nodeId,
    offsetX: event.clientX - nodeRect.left,
    offsetY: event.clientY - nodeRect.top,
    width: nodeRect.width,
    height: nodeRect.height,
    moved: false,
  };

  event.currentTarget.setPointerCapture(event.pointerId);
}

function moveDrag(event) {
  if (!dragging) {
    return;
  }

  const rect = topologyCanvas.getBoundingClientRect();
  const node = getServer(dragging.nodeId) || infrastructureNodes.find((item) => item.id === dragging.nodeId);
  const nextX = ((event.clientX - rect.left - dragging.offsetX) / rect.width) * 100;
  const nextY = ((event.clientY - rect.top - dragging.offsetY) / rect.height) * 100;
  const maxX = 100 - (dragging.width / rect.width) * 100;
  const maxY = 100 - (dragging.height / rect.height) * 100;

  node.x = Math.min(Math.max(nextX, 1), Math.max(maxX, 1));
  node.y = Math.min(Math.max(nextY, 1), Math.max(maxY, 1));
  dragging.moved = true;

  const element = nodeLayer.querySelector(`[data-node-id="${dragging.nodeId}"]`);
  element.style.left = `${node.x}%`;
  element.style.top = `${node.y}%`;
  renderLinks();
}

function stopDrag() {
  if (dragging?.moved) {
    suppressedClickNodeId = dragging.nodeId;
    saveConfig();
  }

  dragging = null;
}

function handleNodeClick(nodeId) {
  if (suppressedClickNodeId === nodeId) {
    suppressedClickNodeId = null;
    return;
  }

  if (dragging?.moved) {
    return;
  }

  if (!joinMode) {
    if (getServer(nodeId)) {
      selectServerForEdit(nodeId);
    }
    return;
  }

  if (!selectedNodeId) {
    selectedNodeId = nodeId;
    renderNodes();
    return;
  }

  if (selectedNodeId !== nodeId) {
    addLink(selectedNodeId, nodeId);
    saveConfig();
  }

  selectedNodeId = null;
  render();
}

function addLink(from, to) {
  const exists = links.some(
    (link) => (link.from === from && link.to === to) || (link.from === to && link.to === from),
  );

  if (!exists) {
    links.push({ from, to });
  }
}

function renderNodes() {
  nodeLayer.innerHTML = "";
  getAllNodes().forEach((node) => {
    nodeLayer.appendChild(makeNodeElement(node));
  });
}

function getNodeCenter(node) {
  const element = nodeLayer.querySelector(`[data-node-id="${node.id}"]`);
  if (!element) {
    return null;
  }

  return {
    x: element.offsetLeft + element.offsetWidth / 2,
    y: element.offsetTop + element.offsetHeight / 2,
  };
}

function renderLinks() {
  linkLayer.innerHTML = "";
  const width = topologyCanvas.clientWidth;
  const height = topologyCanvas.clientHeight;
  linkLayer.setAttribute("viewBox", `0 0 ${width} ${height}`);

  links.forEach((link) => {
    const from = getNode(link.from);
    const to = getNode(link.to);
    if (!from || !to) {
      return;
    }

    const fromCenter = getNodeCenter(from);
    const toCenter = getNodeCenter(to);
    if (!fromCenter || !toCenter) {
      return;
    }

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", fromCenter.x);
    line.setAttribute("y1", fromCenter.y);
    line.setAttribute("x2", toCenter.x);
    line.setAttribute("y2", toCenter.y);
    line.setAttribute("class", "topology-link");
    linkLayer.appendChild(line);
  });
}

function renderVmPool() {
  const assigned = getAssignedVmIds();
  vmPool.innerHTML = "";

  vms
    .filter((vm) => !assigned.has(vm.id))
    .forEach((vm) => {
      vmPool.appendChild(makeVmCard(vm));
    });
}

function renderCounters() {
  serverCount.textContent = servers.length;
  linkCount.textContent = links.length;
  vmCount.textContent = vms.length;
}

function renderJoinState() {
  joinToggle.classList.toggle("is-active", joinMode);
  clearSelection.disabled = !joinMode && !selectedNodeId;
  joinHelp.classList.toggle("is-visible", joinMode);
}

function renderServerFormState() {
  const selectedServer = getServer(selectedServerId);
  const isEditing = Boolean(selectedServer);

  if (!isEditing && selectedServerId) {
    selectedServerId = null;
  }

  serverFormState.textContent = isEditing
    ? `Editing ${selectedServer.name}`
    : "Create a new server";
  serverSubmit.textContent = isEditing ? "Save Changes" : "Add Server";
  deleteServerButton.disabled = !isEditing;
}

function render() {
  renderCounters();
  renderJoinState();
  renderServerFormState();
  renderNodes();
  requestAnimationFrame(renderLinks);
  renderVmPool();
}

function createServer(values) {
  const name = values.name;
  const baseId = slugify(name) || `server-${servers.length + 1}`;
  let id = baseId;
  let suffix = 2;

  while (getNode(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const position = getNextServerPosition();
  servers.push({
    id,
    name,
    status: "Online",
    cpu: values.cpu,
    ram: values.ram,
    storage: values.storage,
    gpus: values.gpus,
    vmIds: [],
    x: position.x,
    y: position.y,
  });

  addLink("switch", id);
  selectedServerId = id;
}

function updateSelectedServer(values) {
  const server = getServer(selectedServerId);
  if (!server) {
    selectedServerId = null;
    createServer(values);
    return;
  }

  server.name = values.name;
  server.cpu = values.cpu;
  server.ram = values.ram;
  server.storage = values.storage;
  server.gpus = values.gpus;
}

function saveServer(event) {
  event.preventDefault();
  const values = getServerFormData();

  if (selectedServerId) {
    updateSelectedServer(values);
  } else {
    createServer(values);
  }

  render();
  saveConfig();
}

function deleteSelectedServer() {
  const serverIndex = servers.findIndex((server) => server.id === selectedServerId);
  if (serverIndex === -1) {
    return;
  }

  const deletedId = selectedServerId;
  servers.splice(serverIndex, 1);
  links.splice(
    0,
    links.length,
    ...links.filter((link) => link.from !== deletedId && link.to !== deletedId),
  );
  resetServerForm();
  saveConfig();
}

serverForm.addEventListener("submit", saveServer);
newServerButton.addEventListener("click", resetServerForm);
deleteServerButton.addEventListener("click", deleteSelectedServer);
joinToggle.addEventListener("click", () => {
  joinMode = !joinMode;
  selectedNodeId = null;
  render();
});
clearSelection.addEventListener("click", () => {
  selectedNodeId = null;
  joinMode = false;
  render();
});
topologyCanvas.addEventListener("pointermove", moveDrag);
topologyCanvas.addEventListener("pointerup", stopDrag);
topologyCanvas.addEventListener("pointercancel", stopDrag);
window.addEventListener("resize", renderLinks);

attachDropZone(vmPool, "pool");
loadConfig().then(() => {
  resetServerForm();
  render();
});
