const DEFAULT_CONFIG = {
  servers: [
    {
      id: "edge-01",
      name: "Edge-01",
      status: "Online",
      cpu: "16 vCPU",
      coresPerCpuChip: 16,
      ram: "64 GB",
      storage: "2 TB NVMe",
      gpus: "1 x NVIDIA A10",
      physicalGpuSlots: 1,
      gpuDevices: [],
      staticIp: "192.168.1.10",
      vmIds: ["vm-web"],
      x: 58,
      y: 8,
    },
    {
      id: "compute-02",
      name: "Compute-02",
      status: "Online",
      cpu: "32 vCPU",
      coresPerCpuChip: 16,
      ram: "128 GB",
      storage: "4 TB SSD",
      gpus: "2 x NVIDIA L40S",
      physicalGpuSlots: 2,
      gpuDevices: [
        {
          id: "gpu-compute-02-01",
          hostServerId: "compute-02",
          displayName: "NVIDIA L40S",
          vendor: "NVIDIA",
          model: "L40S",
          pcieBusString: "PCIROOT(0)#PCI(1D00)#PCI(0000)",
          bus: "",
          device: "",
          function: "",
          hypervLocationPath: "PCIROOT(0)#PCI(1D00)#PCI(0000)",
          assignedVmId: "vm-gpu",
          assignedVmName: "ai-worker",
          assignmentMode: "Hyper-V DDA",
          assignmentStatus: "assigned",
          notes: "Sample Hyper-V DDA assignment",
        },
      ],
      staticIp: "192.168.1.11",
      vmIds: ["vm-gpu"],
      x: 64,
      y: 40,
    },
    {
      id: "storage-03",
      name: "Storage-03",
      status: "Online",
      cpu: "12 vCPU",
      coresPerCpuChip: 12,
      ram: "96 GB",
      storage: "24 TB HDD",
      gpus: "None",
      physicalGpuSlots: 0,
      gpuDevices: [],
      staticIp: "192.168.1.12",
      vmIds: ["vm-db"],
      x: 58,
      y: 72,
    },
  ],
  network: {
    serverSubnet: "192.168.1.0/24",
    subnets: [
      { id: "subnet-primary", label: "Server Subnet", cidr: "192.168.1.0/24" },
      { id: "subnet-storage", label: "Storage", cidr: "10.0.20.0/24" },
    ],
  },
  infrastructureNodes: [
    { id: "desktop", type: "desktop", name: "Admin Desktop", staticIp: "192.168.1.1", x: 8, y: 42 },
    { id: "switch", type: "switch", name: "Core Switch", x: 34, y: 43 },
  ],
  links: [
    { from: "desktop", to: "switch" },
    { from: "switch", to: "edge-01" },
    { from: "switch", to: "compute-02" },
    { from: "switch", to: "storage-03" },
  ],
  vms: [
    { id: "vm-web", name: "web-01", size: "2 CPU / 4 GB", hostServerId: "edge-01" },
    { id: "vm-db", name: "db-01", size: "4 CPU / 16 GB", hostServerId: "storage-03" },
    { id: "vm-test", name: "test-lab", size: "2 CPU / 8 GB", hostServerId: "" },
    {
      id: "vm-gpu",
      name: "ai-worker",
      size: "8 CPU / 32 GB / GPU",
      hostServerId: "compute-02",
      gpuPassthrough: {
        enabled: true,
        gpuId: "gpu-compute-02-01",
        pcieBusString: "PCIROOT(0)#PCI(1D00)#PCI(0000)",
        assignmentMode: "Hyper-V DDA",
      },
    },
    { id: "vm-backup", name: "backup-01", size: "2 CPU / 8 GB", hostServerId: "" },
  ],
};

const CONFIG_API_URL = "/api/config";
const CONFIG_FILE_URL = "data/config.json";

let servers = [];
let network = {};
let infrastructureNodes = [];
let links = [];
let vms = [];

const topologyCanvas = document.querySelector("#topology-canvas");
const nodeLayer = document.querySelector("#node-layer");
const linkLayer = document.querySelector("#link-layer");
const vmPool = document.querySelector("#vm-pool");
const vmForm = document.querySelector("#vm-form");
const vmFormState = document.querySelector("#vm-form-state");
const vmSubmit = document.querySelector("#vm-submit");
const newVmButton = document.querySelector("#new-vm");
const deleteVmButton = document.querySelector("#delete-vm");
const addVmNicButton = document.querySelector("#add-vm-nic");
const vmNicList = document.querySelector("#vm-nic-list");
const vmNicError = document.querySelector("#vm-nic-error");
const serverForm = document.querySelector("#server-form");
const serverFormState = document.querySelector("#server-form-state");
const serverSubmit = document.querySelector("#server-submit");
const newServerButton = document.querySelector("#new-server");
const deleteServerButton = document.querySelector("#delete-server");
const addServerNicButton = document.querySelector("#add-server-nic");
const serverNicList = document.querySelector("#server-nic-list");
const serverNicError = document.querySelector("#server-nic-error");
const addServerNicIpButton = document.querySelector("#add-server-nic-ip");
const serverNicIpList = document.querySelector("#server-nic-ip-list");
const serverNicIpTitle = document.querySelector("#server-nic-ip-title");
const serverCoresPerChipInput = document.querySelector("#server-cores-per-chip");
const serverGpuSlotsInput = document.querySelector("#server-gpu-slots");
const serverCount = document.querySelector("#server-count");
const linkCount = document.querySelector("#link-count");
const vmCount = document.querySelector("#vm-count");
const joinToggle = document.querySelector("#join-toggle");
const clearSelection = document.querySelector("#clear-selection");
const joinHelp = document.querySelector("#join-help");
const networkForm = document.querySelector("#network-form");
const subnetInput = document.querySelector("#subnet-input");
const desktopIpInput = document.querySelector("#desktop-ip-input");
const desktopExtraIpList = document.querySelector("#desktop-extra-ip-list");
const addDesktopIpButton = document.querySelector("#add-desktop-ip");
const subnetSummary = document.querySelector("#subnet-summary");
const subnetList = document.querySelector("#subnet-list");
const subnetAddForm = document.querySelector("#subnet-add-form");
const subnetAddLabel = document.querySelector("#subnet-add-label");
const subnetAddCidr = document.querySelector("#subnet-add-cidr");
const subnetAddError = document.querySelector("#subnet-add-error");
const ipTableBody = document.querySelector("#ip-table-body");
const ipWarnings = document.querySelector("#ip-warnings");
const ipCount = document.querySelector("#ip-count");
const gpuDisplayNameInput = document.querySelector("#gpu-display-name");
const gpuVendorInput = document.querySelector("#gpu-vendor");
const gpuModelInput = document.querySelector("#gpu-model");
const gpuPcieBusInput = document.querySelector("#gpu-pcie-bus");
const gpuBusInput = document.querySelector("#gpu-bus");
const gpuDeviceInput = document.querySelector("#gpu-device");
const gpuFunctionInput = document.querySelector("#gpu-function");
const gpuHypervPathInput = document.querySelector("#gpu-hyperv-path");
const gpuAssignedVmSelect = document.querySelector("#gpu-assigned-vm");
const gpuNotesInput = document.querySelector("#gpu-notes");
const gpuWarning = document.querySelector("#gpu-warning");
const gpuSubmit = document.querySelector("#gpu-submit");
const gpuNewButton = document.querySelector("#gpu-new");
const gpuDeleteButton = document.querySelector("#gpu-delete");
const gpuDeviceList = document.querySelector("#gpu-device-list");
const gpuAssignmentDialog = document.querySelector("#gpu-assignment-dialog");
const gpuAssignmentForm = document.querySelector("#gpu-assignment-form");
const gpuDialogContext = document.querySelector("#gpu-dialog-context");
const gpuDialogLocationInput = document.querySelector("#gpu-dialog-location");
const gpuDialogError = document.querySelector("#gpu-dialog-error");
const gpuDialogSkip = document.querySelector("#gpu-dialog-skip");

let joinMode = false;
let selectedNodeId = null;
let selectedServerId = null;
let selectedVmId = null;
let selectedGpuId = null;
let serverNicDrafts = [];
let selectedServerNicId = null;
let vmNicDrafts = [];
let desktopExtraIpDrafts = [];
let gpuDraftDevices = [];
let pendingGpuAssignment = null;
let dragging = null;
let suppressedClickNodeId = null;
const DEFAULT_SWITCH_PORTS = 8;
const DEFAULT_SERVER_SUBNET = "192.168.1.0/24";
const SAMPLE_PCIE_LOCATION_PATH = "PCIROOT(0)#PCI(1D00)#PCI(0000)";
const MASK_OCTET_PREFIX = {
  255: 8,
  254: 7,
  252: 6,
  248: 5,
  240: 4,
  224: 3,
  192: 2,
  128: 1,
  0: 0,
};

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

function parseIp(value) {
  const octets = parseIpOctets(value);
  if (!octets) {
    return null;
  }

  return octets.reduce((total, octet) => total * 256 + octet, 0);
}

function parseIpOctets(value) {
  const parts = String(value).trim().split(".");
  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }

    const number = Number(part);
    return number >= 0 && number <= 255 ? number : null;
  });

  if (octets.some((octet) => octet === null)) {
    return null;
  }

  return octets;
}

function ipNumberToOctets(number) {
  return [24, 16, 8, 0].map((shift) => Math.floor(number / 256 ** (shift / 8)) % 256);
}

function formatIp(number) {
  return ipNumberToOctets(number).join(".");
}

function prefixToMaskNumber(prefix) {
  let remaining = prefix;
  return [0, 0, 0, 0].reduce((total) => {
    const bits = Math.min(Math.max(remaining, 0), 8);
    remaining -= bits;
    const octet = bits === 0 ? 0 : 256 - 2 ** (8 - bits);
    return total * 256 + octet;
  }, 0);
}

function maskToPrefix(mask) {
  const octets = String(mask).trim().split(".");
  if (octets.length !== 4) {
    return null;
  }

  let prefix = 0;
  let lockedZero = false;

  for (const octetText of octets) {
    if (!/^\d{1,3}$/.test(octetText)) {
      return null;
    }

    const octet = Number(octetText);
    if (!(octet in MASK_OCTET_PREFIX) || (lockedZero && octet !== 0)) {
      return null;
    }

    const bits = MASK_OCTET_PREFIX[octet];
    prefix += bits;
    if (bits < 8) {
      lockedZero = true;
    }
  }

  return prefix;
}

function parseSubnet(value) {
  const raw = String(value).trim().replace(/\s+/g, " ");
  if (!raw) {
    return null;
  }

  let baseIpText = "";
  let maskText = "";

  if (raw.includes("/")) {
    const parts = raw.split("/");
    if (parts.length !== 2) {
      return null;
    }

    [baseIpText, maskText] = parts.map((part) => part.trim());
  } else {
    const parts = raw.split(" ");
    if (parts.length !== 2) {
      return null;
    }

    [baseIpText, maskText] = parts;
  }

  const baseOctets = parseIpOctets(baseIpText);
  if (!baseOctets) {
    return null;
  }

  const ipNumber = baseOctets.reduce((total, octet) => total * 256 + octet, 0);
  const prefix = maskText.includes(".") ? maskToPrefix(maskText) : Number(maskText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return null;
  }

  const typedMatchOctets = getTypedSubnetMatchOctets(baseOctets, prefix);
  const blockSize = 2 ** (32 - prefix);
  const networkNumber = Math.floor(ipNumber / blockSize) * blockSize;
  const broadcastNumber = networkNumber + blockSize - 1;
  const firstUsable = prefix >= 31 ? networkNumber : networkNumber + 1;
  const lastUsable = prefix >= 31 ? broadcastNumber : broadcastNumber - 1;

  return {
    input: raw,
    prefix,
    baseIp: baseIpText,
    baseOctets,
    typedMatchOctets,
    mask: formatIp(prefixToMaskNumber(prefix)),
    cidr: `${formatIp(networkNumber)}/${prefix}`,
    networkAddress: formatIp(networkNumber),
    firstUsable,
    lastUsable,
  };
}

function getTypedSubnetMatchOctets(baseOctets, prefix) {
  if (prefix >= 32) {
    return 4;
  }

  const prefixOctets = Math.min(Math.floor(prefix / 8), 3);
  const lastTypedNetworkOctet = baseOctets.reduce((lastIndex, octet, index) => {
    return octet !== 0 && index < 3 ? index : lastIndex;
  }, -1);

  return Math.max(prefixOctets, lastTypedNetworkOctet + 1);
}

function matchesTypedSubnet(ipNumber, subnet) {
  if (!subnet || !subnet.typedMatchOctets) {
    return true;
  }

  const ipOctets = ipNumberToOctets(ipNumber);
  for (let index = 0; index < subnet.typedMatchOctets; index += 1) {
    if (ipOctets[index] !== subnet.baseOctets[index]) {
      return false;
    }
  }

  return true;
}

function isIpInSubnet(ipNumber, subnet) {
  return (
    subnet &&
    ipNumber >= subnet.firstUsable &&
    ipNumber <= subnet.lastUsable &&
    matchesTypedSubnet(ipNumber, subnet)
  );
}

function formatTypedSubnetHint(subnet) {
  if (!subnet || subnet.typedMatchOctets === 0) {
    return "Any IPv4";
  }

  if (subnet.typedMatchOctets === 4) {
    return subnet.baseIp;
  }

  return [0, 1, 2, 3]
    .map((index) => (index < subnet.typedMatchOctets ? subnet.baseOctets[index] : "x"))
    .join(".");
}

function getCurrentSubnet() {
  return parseSubnet(network.serverSubnet || DEFAULT_SERVER_SUBNET);
}

function getNetworkSubnets() {
  return Array.isArray(network.subnets) ? network.subnets : [];
}

// Defined subnets paired with their parsed form, skipping any invalid CIDRs.
function getSubnetList() {
  return getNetworkSubnets()
    .map((subnet) => ({ ...subnet, parsed: parseSubnet(subnet.cidr) }))
    .filter((subnet) => subnet.parsed);
}

function getSubnetById(subnetId) {
  return getNetworkSubnets().find((subnet) => subnet.id === subnetId) || null;
}

function getDefaultSubnetId() {
  return getNetworkSubnets()[0]?.id || "";
}

// Describe which defined subnet an IP belongs to, preferring an explicit
// subnetId assignment and otherwise matching by address.
function describeIpSubnet(ip) {
  if (ip.subnetId) {
    const target = getSubnetById(ip.subnetId);
    if (target) {
      return target.label;
    }
  }
  if (ip.version === "IPv4" && ip.address) {
    const ipNumber = parseIp(ip.address);
    if (ipNumber !== null) {
      const match = getSubnetList().find((subnet) => isIpInSubnet(ipNumber, subnet.parsed));
      if (match) {
        return match.label;
      }
    }
  }
  const cidr = formatIpCidr(ip);
  if (cidr.includes("/")) {
    return `/${getIpEffectivePrefix(ip)}`;
  }
  return ip.subnetMask || (ip.subnetId ? ip.subnetId : "—");
}

// Validate a NIC IP against the defined subnets: against its assigned subnet
// when subnetId is set, otherwise against the full set of defined subnets.
function getNicIpSubnetMessage(ip) {
  if (ip.version !== "IPv4" || ip.assignmentType !== "static" || !ip.address) {
    return "";
  }
  const ipNumber = parseIp(ip.address);
  if (ipNumber === null) {
    return "";
  }
  const subnets = getSubnetList();
  if (!subnets.length) {
    return "";
  }
  if (ip.subnetId) {
    const target = subnets.find((subnet) => subnet.id === ip.subnetId);
    if (!target) {
      return `References unknown subnet "${ip.subnetId}"`;
    }
    return isIpInSubnet(ipNumber, target.parsed) ? "" : `Outside subnet ${target.label} (${target.parsed.cidr})`;
  }
  return subnets.some((subnet) => isIpInSubnet(ipNumber, subnet.parsed))
    ? ""
    : "Outside every defined subnet";
}

function getEditableServerNic(server) {
  const nics = Array.isArray(server?.nics) ? server.nics : [];
  return nics.find((nic) => nic.adapterType === "management-os") || nics[0] || null;
}

function normalizeServerNicIpDraft(ip) {
  const safeIp = ip && typeof ip === "object" ? ip : {};
  return {
    id: typeof safeIp.id === "string" && safeIp.id.trim() ? safeIp.id.trim() : `ip-${crypto.randomUUID()}`,
    address: typeof safeIp.address === "string" ? safeIp.address.trim() : "",
    subnetId: typeof safeIp.subnetId === "string" ? safeIp.subnetId.trim() : getDefaultSubnetId(),
  };
}

function normalizeServerNicDraft(nic, serverId = "") {
  const safeNic = nic && typeof nic === "object" ? nic : {};
  return {
    id: typeof safeNic.id === "string" && safeNic.id.trim() ? safeNic.id.trim() : `nic-${crypto.randomUUID()}`,
    hostServerId:
      typeof safeNic.hostServerId === "string" && safeNic.hostServerId.trim() ? safeNic.hostServerId.trim() : serverId,
    name: typeof safeNic.name === "string" && safeNic.name.trim() ? safeNic.name.trim() : "Management",
    adapterType:
      typeof safeNic.adapterType === "string" && NIC_ADAPTER_TYPES.includes(safeNic.adapterType)
        ? safeNic.adapterType
        : "management-os",
    macAddress: typeof safeNic.macAddress === "string" ? safeNic.macAddress.trim() : "",
    connectedVirtualSwitchId:
      typeof safeNic.connectedVirtualSwitchId === "string" ? safeNic.connectedVirtualSwitchId.trim() : "",
    vlanId: toNullableInteger(safeNic.vlanId),
    ipAddresses: Array.isArray(safeNic.ipAddresses)
      ? safeNic.ipAddresses.map(normalizeServerNicIpDraft)
      : [],
  };
}

function getDefaultServerNicName(index, adapterType = "physical") {
  if (adapterType === "management-os") {
    return "Management";
  }
  return `NIC ${index + 1}`;
}

function getServerNicDraftsFromServer(server) {
  const primaryIp = String(server?.staticIp || "").trim();
  return (Array.isArray(server?.nics) ? server.nics : []).map((nic) => {
    const normalized = normalizeServerNicDraft(nic, server?.id || "");
    if (normalized.adapterType === "management-os" && primaryIp) {
      normalized.ipAddresses = normalized.ipAddresses.filter((ip) => ip.address !== primaryIp);
    }
    return normalized;
  });
}

function getSelectedServerNicDraft() {
  return serverNicDrafts.find((nic) => nic.id === selectedServerNicId) || null;
}

function syncSelectedServerNic() {
  if (!serverNicDrafts.length) {
    selectedServerNicId = null;
    return;
  }
  if (!serverNicDrafts.some((nic) => nic.id === selectedServerNicId)) {
    selectedServerNicId = serverNicDrafts[0].id;
  }
}

function setServerNicEditorError(message = "") {
  if (serverNicError) {
    serverNicError.textContent = message;
  }
}

function renderServerNicIpEditor() {
  if (!serverNicIpList) {
    return;
  }

  const nic = getSelectedServerNicDraft();
  const primaryIp = String(serverForm?.elements?.staticIp?.value || "").trim();
  const showPrimaryIp = Boolean(primaryIp) && nic?.adapterType === "management-os";
  if (serverNicIpTitle) {
    serverNicIpTitle.textContent = nic ? `IP Addresses: ${nic.name}` : "IP Addresses";
  }
  if (!nic) {
    serverNicIpList.innerHTML = `<div class="server-nic-empty">Select a NIC to manage its IP addresses.</div>`;
    if (addServerNicIpButton) {
      addServerNicIpButton.disabled = true;
    }
    return;
  }

  if (addServerNicIpButton) {
    addServerNicIpButton.disabled = false;
  }

  const subnetOptions = getNetworkSubnets();
  if (!nic.ipAddresses.length && !showPrimaryIp) {
    serverNicIpList.innerHTML = `<div class="server-nic-empty">No IP addresses assigned to this NIC.</div>`;
    return;
  }

  const primaryRow = showPrimaryIp
    ? `
        <div class="server-nic-ip-row is-primary">
          <label>
            <span>Primary IP</span>
            <input value="${escapeHtml(primaryIp)}" readonly />
          </label>
          <div class="server-nic-ip-primary-note">From Static IP above</div>
        </div>
      `
    : "";

  serverNicIpList.innerHTML = `
    ${primaryRow}
    ${nic.ipAddresses
      .map((ip) => {
      const subnetSelect = `
        <select data-server-nic-ip-field="subnetId" data-server-nic-id="${escapeHtml(nic.id)}" data-server-nic-ip-id="${escapeHtml(ip.id)}">
          <option value="">Auto-detect</option>
          ${subnetOptions
            .map(
              (subnet) =>
                `<option value="${escapeHtml(subnet.id)}"${subnet.id === ip.subnetId ? " selected" : ""}>${escapeHtml(subnet.label)}</option>`,
            )
            .join("")}
        </select>
      `;

      return `
        <div class="server-nic-ip-row" data-server-nic-ip-id="${escapeHtml(ip.id)}">
          <label>
            <span>IP Address</span>
            <input data-server-nic-ip-field="address" data-server-nic-id="${escapeHtml(nic.id)}" data-server-nic-ip-id="${escapeHtml(ip.id)}" value="${escapeHtml(ip.address)}" placeholder="192.168.1.14" autocomplete="off" />
          </label>
          <label>
            <span>Subnet</span>
            ${subnetSelect}
          </label>
          <button type="button" class="danger-button server-nic-ip-remove" data-server-nic-ip-remove="${escapeHtml(ip.id)}" data-server-nic-id="${escapeHtml(nic.id)}">Remove</button>
        </div>
      `;
      })
      .join("")}
  `;
}

function renderServerNicEditor() {
  if (!serverNicList) {
    return;
  }

  syncSelectedServerNic();
  if (!serverNicDrafts.length) {
    serverNicList.innerHTML = `<div class="server-nic-empty">No NIC adapters yet.</div>`;
    renderServerNicIpEditor();
    return;
  }

  serverNicList.innerHTML = serverNicDrafts
    .map((nic, index) => {
      const nicName = nic.name || getDefaultServerNicName(index, nic.adapterType);
      const typeLabel = getNicTypeLabel(nic.adapterType);
      const primaryIp = String(serverForm?.elements?.staticIp?.value || "").trim();
      const visibleIpCount = nic.ipAddresses.length + (nic.adapterType === "management-os" && primaryIp ? 1 : 0);
      const isSelected = nic.id === selectedServerNicId;
      if (isSelected) {
        return `
          <div class="server-nic-card is-selected" data-server-nic-select="${escapeHtml(nic.id)}" tabindex="0" role="button">
            <div class="server-nic-card-main">
              <label>
                <span>Name</span>
                <input data-server-nic-field="name" data-server-nic-id="${escapeHtml(nic.id)}" value="${escapeHtml(nic.name)}" placeholder="${escapeHtml(nicName)}" autocomplete="off" />
              </label>
            </div>
            <div class="server-nic-card-footer">
              <div class="server-nic-card-meta">
                <span class="server-nic-pill">${escapeHtml(typeLabel)}</span>
                <span class="server-nic-pill">${escapeHtml(visibleIpCount)} IP${visibleIpCount === 1 ? "" : "s"}</span>
              </div>
              <button type="button" class="danger-button server-nic-remove" data-server-nic-remove="${escapeHtml(nic.id)}">Remove NIC</button>
            </div>
          </div>
        `;
      }
      return `
        <div class="server-nic-card" data-server-nic-select="${escapeHtml(nic.id)}" tabindex="0" role="button">
          <div class="server-nic-card-footer">
            <div class="server-nic-card-meta">
              <strong class="server-nic-name">${escapeHtml(nicName)}</strong>
              <span class="server-nic-pill">${escapeHtml(typeLabel)}</span>
              <span class="server-nic-pill">${escapeHtml(visibleIpCount)} IP${visibleIpCount === 1 ? "" : "s"}</span>
            </div>
            <button type="button" class="danger-button server-nic-remove" data-server-nic-remove="${escapeHtml(nic.id)}">Remove</button>
          </div>
        </div>
      `;
    })
    .join("");

  renderServerNicIpEditor();
}

function addServerNicDraft() {
  const adapterType = serverNicDrafts.length ? "physical" : "management-os";
  const nic = normalizeServerNicDraft(
    {
      name: getDefaultServerNicName(serverNicDrafts.length, adapterType),
      adapterType,
      ipAddresses: [],
    },
    selectedServerId || "",
  );
  serverNicDrafts.push(nic);
  selectedServerNicId = nic.id;
  setServerNicEditorError("");
  renderServerNicEditor();
}

function selectServerNicDraft(nicId) {
  selectedServerNicId = nicId;
  renderServerNicEditor();
}

function updateServerNicDraft(nicId, field, value) {
  serverNicDrafts = serverNicDrafts.map((nic) =>
    nic.id === nicId
      ? {
          ...nic,
          [field]: field === "vlanId" ? toNullableInteger(value) : typeof value === "string" ? value.trim() : value,
        }
      : nic,
  );
  setServerNicEditorError("");
}

function removeServerNicDraft(nicId) {
  serverNicDrafts = serverNicDrafts.filter((nic) => nic.id !== nicId);
  if (selectedServerNicId === nicId) {
    selectedServerNicId = serverNicDrafts[0]?.id || null;
  }
  setServerNicEditorError("");
  renderServerNicEditor();
}

function addServerNicIpDraft(nicId) {
  serverNicDrafts = serverNicDrafts.map((nic) =>
    nic.id === nicId
      ? {
          ...nic,
          ipAddresses: [...nic.ipAddresses, normalizeServerNicIpDraft({ subnetId: getDefaultSubnetId() })],
        }
      : nic,
  );
  setServerNicEditorError("");
  renderServerNicEditor();
}

function updateServerNicIpDraft(nicId, ipId, field, value) {
  serverNicDrafts = serverNicDrafts.map((nic) =>
    nic.id === nicId
      ? {
          ...nic,
          ipAddresses: nic.ipAddresses.map((ip) =>
            ip.id === ipId
              ? {
                  ...ip,
                  [field]: typeof value === "string" ? value.trim() : value,
                }
              : ip,
          ),
        }
      : nic,
  );
  setServerNicEditorError("");
}

function removeServerNicIpDraft(nicId, ipId) {
  serverNicDrafts = serverNicDrafts.map((nic) =>
    nic.id === nicId
      ? {
          ...nic,
          ipAddresses: nic.ipAddresses.filter((ip) => ip.id !== ipId),
        }
      : nic,
  );
  setServerNicEditorError("");
  renderServerNicEditor();
}

function buildServerNicsFromDrafts(serverId, primaryIp, nicDrafts) {
  const drafts = nicDrafts.length ? nicDrafts : [normalizeServerNicDraft({ name: "Management", adapterType: "management-os" }, serverId)];
  let primaryAssigned = false;

  return drafts.map((draft, index) => {
    const nicName = draft.name || getDefaultServerNicName(index, draft.adapterType);
    const ipAddresses = draft.ipAddresses
      .filter((ip) => ip.address)
      .map((ip) => {
        const subnet = ip.subnetId ? getSubnetById(ip.subnetId) : null;
        const parsed = subnet ? parseSubnet(subnet.cidr) : null;
        return normalizeIpAddress({
          id: ip.id,
          address: ip.address,
          version: "IPv4",
          cidrPrefix: parsed?.prefix ?? null,
          subnetMask: parsed?.mask ?? "",
          assignmentType: "static",
          subnetId: ip.subnetId || "",
          role: "",
        });
      });

    if (!primaryAssigned && primaryIp) {
      const hasPrimaryIp = ipAddresses.some((ip) => ip.address === primaryIp);
      if (!hasPrimaryIp) {
        const subnetId = ipAddresses[0]?.subnetId || getDefaultSubnetId();
        const subnet = subnetId ? getSubnetById(subnetId) : null;
        const parsed = subnet ? parseSubnet(subnet.cidr) : getCurrentSubnet();
        ipAddresses.unshift(
          normalizeIpAddress({
            id: `ip-${serverId}-primary`,
            address: primaryIp,
            version: "IPv4",
            cidrPrefix: parsed?.prefix ?? null,
            subnetMask: parsed?.mask ?? "",
            assignmentType: "static",
            subnetId,
            role: index === 0 ? "primary" : "",
          }),
        );
      }
      primaryAssigned = true;
    }

    return normalizeNic(
      {
        id: draft.id,
        hostServerId: serverId,
        name: nicName,
        adapterType: draft.adapterType,
        macAddress: draft.macAddress,
        connectedVirtualSwitchId: draft.connectedVirtualSwitchId,
        vlanId: draft.vlanId,
        ipAddresses,
      },
      { hostServerId: serverId },
    );
  });
}

function getIpValidationMessage(ipAddress, subnet = getCurrentSubnet()) {
  const value = String(ipAddress || "").trim();
  if (!value) {
    return "";
  }

  const ipNumber = parseIp(value);
  if (ipNumber === null) {
    return "Invalid IPv4 address";
  }

  if (!subnet) {
    return "";
  }

  if (!isIpInSubnet(ipNumber, subnet)) {
    return `Outside server subnet ${subnet.input}`;
  }

  return "";
}

function getAnySubnetValidationMessage(ipAddress) {
  const value = String(ipAddress || "").trim();
  if (!value) {
    return "";
  }
  const ipNumber = parseIp(value);
  if (ipNumber === null) {
    return "Invalid IPv4 address";
  }
  const subnets = getSubnetList();
  if (!subnets.length) {
    return "";
  }
  return subnets.some((s) => isIpInSubnet(ipNumber, s.parsed)) ? "" : "Not in any defined subnet";
}

function makeIpChip(ipAddress, extraClass = "", anySubnet = false) {
  const value = String(ipAddress || "").trim();
  const validationMessage = anySubnet
    ? getAnySubnetValidationMessage(value)
    : getIpValidationMessage(value);
  const classes = ["ip-chip", extraClass, validationMessage ? "is-invalid-ip" : ""]
    .filter(Boolean)
    .join(" ");
  const title = validationMessage ? ` title="${escapeHtml(validationMessage)}"` : "";

  return `<div class="${classes}"${title}>${escapeHtml(value || "IP unassigned")}</div>`;
}

function getEmptyGpuPassthrough() {
  return {
    enabled: false,
    gpuId: "",
    pcieBusString: "",
    assignmentMode: "",
  };
}

function normalizeGpuPassthrough(value) {
  const safeValue = value && typeof value === "object" ? value : {};
  return {
    enabled: Boolean(safeValue.enabled),
    gpuId: typeof safeValue.gpuId === "string" ? safeValue.gpuId : "",
    pcieBusString: typeof safeValue.pcieBusString === "string" ? safeValue.pcieBusString : "",
    assignmentMode: typeof safeValue.assignmentMode === "string" ? safeValue.assignmentMode : "",
  };
}

function normalizeGpuDevice(gpu, hostServerId = "") {
  const safeGpu = gpu && typeof gpu === "object" ? gpu : {};
  const displayName =
    typeof safeGpu.displayName === "string" && safeGpu.displayName.trim()
      ? safeGpu.displayName.trim()
      : typeof safeGpu.model === "string"
        ? safeGpu.model.trim()
        : "";

  return {
    id: typeof safeGpu.id === "string" && safeGpu.id.trim() ? safeGpu.id : `gpu-${crypto.randomUUID()}`,
    hostServerId: typeof safeGpu.hostServerId === "string" && safeGpu.hostServerId.trim()
      ? safeGpu.hostServerId
      : hostServerId,
    displayName,
    vendor: typeof safeGpu.vendor === "string" ? safeGpu.vendor.trim() : "",
    model: typeof safeGpu.model === "string" ? safeGpu.model.trim() : "",
    pcieBusString: typeof safeGpu.pcieBusString === "string" ? safeGpu.pcieBusString.trim() : "",
    bus: typeof safeGpu.bus === "string" ? safeGpu.bus.trim() : "",
    device: typeof safeGpu.device === "string" ? safeGpu.device.trim() : "",
    function: typeof safeGpu.function === "string" ? safeGpu.function.trim() : "",
    hypervLocationPath: typeof safeGpu.hypervLocationPath === "string" ? safeGpu.hypervLocationPath.trim() : "",
    assignedVmId: typeof safeGpu.assignedVmId === "string" ? safeGpu.assignedVmId.trim() : "",
    assignedVmName: typeof safeGpu.assignedVmName === "string" ? safeGpu.assignedVmName.trim() : "",
    assignmentMode: "Hyper-V DDA",
    assignmentStatus:
      typeof safeGpu.assignmentStatus === "string" && safeGpu.assignmentStatus.trim()
        ? safeGpu.assignmentStatus.trim()
        : "missing-vm-link",
    notes: typeof safeGpu.notes === "string" ? safeGpu.notes.trim() : "",
  };
}

const NIC_ADAPTER_TYPES = ["physical", "vm", "management-os", "virtual-switch"];

function detectIpVersion(address) {
  const value = String(address || "").trim();
  if (!value) {
    return "";
  }
  if (value.includes(":")) {
    return "IPv6";
  }
  return parseIp(value) !== null ? "IPv4" : "";
}

function isValidIpAddress(address, version) {
  const value = String(address || "").trim();
  if (!value) {
    return false;
  }
  if (version === "IPv6") {
    return value.includes(":") && /^[0-9a-f:]+$/i.test(value);
  }
  return parseIp(value) !== null;
}

function normalizeDnsServers(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\s,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function toNullableInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function normalizeIpAddress(ip) {
  const safeIp = ip && typeof ip === "object" ? ip : {};
  const address = typeof safeIp.address === "string" ? safeIp.address.trim() : "";
  const version =
    safeIp.version === "IPv6" || safeIp.version === "IPv4"
      ? safeIp.version
      : detectIpVersion(address) || "IPv4";

  return {
    id: typeof safeIp.id === "string" && safeIp.id.trim() ? safeIp.id : `ip-${crypto.randomUUID()}`,
    address,
    version,
    cidrPrefix: toNullableInteger(safeIp.cidrPrefix),
    subnetMask: typeof safeIp.subnetMask === "string" ? safeIp.subnetMask.trim() : "",
    gateway: typeof safeIp.gateway === "string" ? safeIp.gateway.trim() : "",
    dnsServers: normalizeDnsServers(safeIp.dnsServers),
    assignmentType: safeIp.assignmentType === "dhcp" ? "dhcp" : "static",
    role: typeof safeIp.role === "string" && safeIp.role.trim() ? safeIp.role.trim() : "",
    subnetId: typeof safeIp.subnetId === "string" ? safeIp.subnetId.trim() : "",
    notes: typeof safeIp.notes === "string" ? safeIp.notes.trim() : "",
  };
}

function normalizeNic(nic, { hostServerId = "", vmId = "" } = {}) {
  const safeNic = nic && typeof nic === "object" ? nic : {};
  const adapterType = NIC_ADAPTER_TYPES.includes(safeNic.adapterType)
    ? safeNic.adapterType
    : vmId
      ? "vm"
      : "physical";

  return {
    id: typeof safeNic.id === "string" && safeNic.id.trim() ? safeNic.id : `nic-${crypto.randomUUID()}`,
    hostServerId:
      typeof safeNic.hostServerId === "string" && safeNic.hostServerId.trim()
        ? safeNic.hostServerId
        : hostServerId,
    vmId: typeof safeNic.vmId === "string" && safeNic.vmId.trim() ? safeNic.vmId : vmId || "",
    name: typeof safeNic.name === "string" && safeNic.name.trim() ? safeNic.name.trim() : "Network Adapter",
    adapterType,
    macAddress: typeof safeNic.macAddress === "string" ? safeNic.macAddress.trim() : "",
    connectedVirtualSwitchId:
      typeof safeNic.connectedVirtualSwitchId === "string" ? safeNic.connectedVirtualSwitchId.trim() : "",
    connectedVirtualSwitchName:
      typeof safeNic.connectedVirtualSwitchName === "string"
        ? safeNic.connectedVirtualSwitchName.trim()
        : typeof safeNic.connectedVirtualSwitchId === "string"
          ? safeNic.connectedVirtualSwitchId.trim()
          : "",
    vlanId: toNullableInteger(safeNic.vlanId),
    ipAddresses: Array.isArray(safeNic.ipAddresses) ? safeNic.ipAddresses.map(normalizeIpAddress) : [],
    status: typeof safeNic.status === "string" && safeNic.status.trim() ? safeNic.status.trim() : "connected",
    notes: typeof safeNic.notes === "string" ? safeNic.notes.trim() : "",
  };
}

// Build a host management adapter from a legacy single staticIp so existing
// configs keep showing their address once the NIC model is introduced.
function makeManagementNic(staticIp, serverId) {
  const address = String(staticIp || "").trim();
  const subnet = getCurrentSubnet();
  return normalizeNic(
    {
      id: `nic-${serverId}-mgmt`,
      hostServerId: serverId,
      name: "Management",
      adapterType: "management-os",
      ipAddresses: address
        ? [
            {
              id: `ip-${serverId}-mgmt`,
              address,
              version: "IPv4",
              cidrPrefix: subnet ? subnet.prefix : null,
              subnetMask: subnet ? subnet.mask : "",
              assignmentType: "static",
              role: "management",
            },
          ]
        : [],
    },
    { hostServerId: serverId },
  );
}

function parseGpuSlotCount(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(0, Math.floor(number));
}

function parsePositiveInteger(value, fallback = 1) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return fallback;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(1, Math.floor(number));
}

function parseCpuCount(value) {
  const match = String(value || "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function inferCoresPerCpuChip(server) {
  if (Number.isFinite(Number(server.coresPerCpuChip))) {
    return parsePositiveInteger(server.coresPerCpuChip);
  }

  const cpuCount = parseCpuCount(server.cpu);
  return cpuCount || 1;
}

function getServerCpuTopology(server) {
  const totalCpu = parseCpuCount(server?.cpu);
  const coresPerCpuChip = parsePositiveInteger(server?.coresPerCpuChip, totalCpu || 1);
  const physicalChips = totalCpu ? Math.max(1, Math.ceil(totalCpu / coresPerCpuChip)) : null;

  return {
    totalCpu,
    coresPerCpuChip,
    physicalChips,
    numaCpuPerNode: coresPerCpuChip,
  };
}

function getVmCpuCount(vm) {
  return parseCpuCount(vm?.cpu ?? vm?.size);
}

function getVmNumaGuidance(vm, server = getVmHostServer(vm?.id)) {
  if (!vm || !server) {
    return null;
  }

  const vmCpuCount = getVmCpuCount(vm);
  const topology = getServerCpuTopology(server);
  if (!vmCpuCount || !topology.numaCpuPerNode) {
    return null;
  }

  return {
    vmCpuCount,
    numaCpuPerNode: topology.numaCpuPerNode,
    numaNodesNeeded: Math.max(1, Math.ceil(vmCpuCount / topology.numaCpuPerNode)),
    crossesNuma: vmCpuCount > topology.numaCpuPerNode,
  };
}

function inferGpuSlotCount(server) {
  if (Number.isFinite(Number(server.physicalGpuSlots))) {
    return parseGpuSlotCount(server.physicalGpuSlots);
  }

  const gpuSummary = String(server.gpus || "").trim();
  const summaryCount = Number(gpuSummary.match(/^\d+/)?.[0]);
  if (Number.isFinite(summaryCount)) {
    return Math.max(summaryCount, Array.isArray(server.gpuDevices) ? server.gpuDevices.length : 0);
  }

  return Array.isArray(server.gpuDevices) ? server.gpuDevices.length : 0;
}

function getServerGpuDevices(server) {
  return Array.isArray(server?.gpuDevices) ? server.gpuDevices : [];
}

function getAssignedGpuCount(server) {
  return getServerGpuDevices(server).filter((gpu) => gpu.assignmentStatus === "assigned").length;
}

function getAvailableGpuCount(server) {
  return Math.max(0, parseGpuSlotCount(server?.physicalGpuSlots) - getAssignedGpuCount(server));
}

function getVmHostServer(vmId) {
  return servers.find((server) => server.vmIds.includes(vmId)) || null;
}

function getAllGpuDevices() {
  return servers.flatMap((server) =>
    (Array.isArray(server.gpuDevices) ? server.gpuDevices : []).map((gpu) => ({
      ...gpu,
      hostServerId: server.id,
    })),
  );
}

function getGpuById(gpuId) {
  return getAllGpuDevices().find((gpu) => gpu.id === gpuId) || null;
}

function getGpuDevicesForVm(vmId) {
  return getAllGpuDevices().filter((gpu) => gpu.assignedVmId === vmId);
}

function getGpuDevicesForValidation() {
  return servers.flatMap((server) => {
    const devices = server.id === selectedServerId ? gpuDraftDevices : server.gpuDevices;
    return (Array.isArray(devices) ? devices : []).map((gpu) => ({
      ...gpu,
      hostServerId: server.id,
    }));
  });
}

function getDuplicatePcieBusStrings(devices = getAllGpuDevices()) {
  const counts = new Map();
  devices.forEach((gpu) => {
    const key = String(gpu.pcieBusString || "").trim().toLowerCase();
    if (key) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  });

  return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
}

function getGpuAssignmentStatus(gpu, hostServerId, devices = getAllGpuDevices()) {
  const pcieKey = String(gpu.pcieBusString || "").trim().toLowerCase();
  const duplicatePcie = pcieKey && getDuplicatePcieBusStrings(devices).has(pcieKey);
  const assignedVm = getVm(gpu.assignedVmId);
  const hostServer = getServer(hostServerId);
  const vmHostServer = gpu.assignedVmId ? getVmHostServer(gpu.assignedVmId) : null;

  if (!gpu.pcieBusString) {
    return "unavailable";
  }

  if (!gpu.assignedVmId) {
    return "missing-vm-link";
  }

  if (duplicatePcie || (assignedVm && hostServer && vmHostServer?.id !== hostServer.id)) {
    return "conflict";
  }

  if (!assignedVm || !hostServer) {
    return "unavailable";
  }

  return "assigned";
}

function getGpuStatusLabel(status) {
  const labels = {
    assigned: "Assigned",
    "missing-vm-link": "Missing VM link",
    conflict: "Conflict",
    unavailable: "Unavailable",
  };
  return labels[status] || "Needs review";
}

function clearVmGpuPassthrough(vmId) {
  const vm = getVm(vmId);
  if (!vm) {
    return;
  }

  vm.gpuPassthrough = getEmptyGpuPassthrough();
  vm.gpuPassthroughWarning = "";
}

function releaseGpuAssignmentsForVm(vmId) {
  servers.forEach((server) => {
    server.gpuDevices = getServerGpuDevices(server).filter((gpu) => gpu.assignedVmId !== vmId);
  });

  clearVmGpuPassthrough(vmId);

  if (selectedServerId) {
    const selectedServer = getServer(selectedServerId);
    gpuDraftDevices = selectedServer ? clone(selectedServer.gpuDevices || []) : [];
  }
}

function setGpuDialogError(message) {
  gpuDialogError.textContent = message;
  gpuDialogError.classList.toggle("is-visible", Boolean(message));
}

function closeGpuAssignmentDialog() {
  pendingGpuAssignment = null;
  gpuAssignmentDialog.hidden = true;
  gpuDialogLocationInput.value = "";
  setGpuDialogError("");
}

function openGpuAssignmentDialog(vmId, serverId) {
  const server = getServer(serverId);
  const vm = getVm(vmId);
  if (!server || !vm) {
    return;
  }

  syncGpuAssignments();
  const availableGpuCount = getAvailableGpuCount(server);
  if (availableGpuCount <= 0) {
    return;
  }

  pendingGpuAssignment = { vmId, serverId };
  gpuDialogContext.textContent = `${server.name} has ${availableGpuCount} GPU slot${availableGpuCount === 1 ? "" : "s"} left. Assign one to ${vm.name} by entering the PCIe / Hyper-V location path.`;
  gpuDialogLocationInput.value = SAMPLE_PCIE_LOCATION_PATH;
  setGpuDialogError("");
  gpuAssignmentDialog.hidden = false;
  requestAnimationFrame(() => {
    gpuDialogLocationInput.focus();
    gpuDialogLocationInput.select();
  });
}

function assignPendingGpuPassthrough(locationPath) {
  if (!pendingGpuAssignment) {
    return false;
  }

  const server = getServer(pendingGpuAssignment.serverId);
  const vm = getVm(pendingGpuAssignment.vmId);
  if (!server || !vm) {
    setGpuDialogError("The VM or server no longer exists.");
    return false;
  }

  syncGpuAssignments();
  if (getAvailableGpuCount(server) <= 0) {
    setGpuDialogError("This server does not have a GPU slot left.");
    return false;
  }

  if (!locationPath) {
    setGpuDialogError("Enter the GPU PCIe / Hyper-V location path.");
    return false;
  }

  const duplicatePcie = getAllGpuDevices().some((gpu) => {
    return String(gpu.pcieBusString || "").trim().toLowerCase() === locationPath.toLowerCase();
  });
  if (duplicatePcie) {
    setGpuDialogError("Another GPU already uses this PCIe / Hyper-V location path.");
    return false;
  }

  server.gpuDevices.push(
    normalizeGpuDevice(
      {
        id: makeGpuId(`${vm.name}-gpu`),
        hostServerId: server.id,
        displayName: "GPU passthrough",
        vendor: "GPU",
        model: "",
        pcieBusString: locationPath,
        hypervLocationPath: locationPath,
        assignedVmId: vm.id,
        assignedVmName: vm.name,
        assignmentMode: "Hyper-V DDA",
        assignmentStatus: "assigned",
        notes: "Assigned when VM was dropped onto server.",
      },
      server.id,
    ),
  );

  syncGpuAssignments();
  refreshGpuDraftFromSelectedServer();
  render();
  saveConfig();
  closeGpuAssignmentDialog();
  return true;
}

function syncGpuAssignments() {
  const previousGpuRefs = new Map(
    vms.map((vm) => [vm.id, normalizeGpuPassthrough(vm.gpuPassthrough)]),
  );
  const hostByVmId = new Map();
  servers.forEach((server) => {
    server.vmIds = Array.isArray(server.vmIds) ? server.vmIds : [];
    server.vmIds.forEach((vmId) => hostByVmId.set(vmId, server.id));
  });

  vms.forEach((vm) => {
    vm.hostServerId = hostByVmId.get(vm.id) || "";
    vm.gpuPassthrough = getEmptyGpuPassthrough();
    vm.gpuPassthroughWarning = "";
    vm.nics = getVmNicList(vm).map((nic) =>
      normalizeNic(
        {
          ...nic,
          vmId: vm.id,
          hostServerId: vm.hostServerId,
          connectedVirtualSwitchName: nic.connectedVirtualSwitchName || nic.connectedVirtualSwitchId,
        },
        { vmId: vm.id, hostServerId: vm.hostServerId },
      ),
    );
  });

  const allDevices = getAllGpuDevices();
  servers.forEach((server) => {
    server.gpuDevices = (Array.isArray(server.gpuDevices) ? server.gpuDevices : []).map((gpu) => {
      const assignedVm = getVm(gpu.assignedVmId);
      const normalizedGpu = normalizeGpuDevice(
        {
          ...gpu,
          hostServerId: server.id,
          assignedVmName: assignedVm ? assignedVm.name : gpu.assignedVmName,
        },
        server.id,
      );
      normalizedGpu.assignmentStatus = getGpuAssignmentStatus(normalizedGpu, server.id, allDevices);

      if (assignedVm && normalizedGpu.assignmentStatus === "assigned") {
        assignedVm.gpuPassthrough = {
          enabled: true,
          gpuId: normalizedGpu.id,
          pcieBusString: normalizedGpu.pcieBusString,
          assignmentMode: normalizedGpu.assignmentMode,
        };
      }

      return normalizedGpu;
    });
  });

  vms.forEach((vm) => {
    const previousRef = previousGpuRefs.get(vm.id);
    if (!vm.gpuPassthrough.enabled && previousRef?.enabled) {
      vm.gpuPassthrough = previousRef;
      vm.gpuPassthroughWarning =
        !previousRef.gpuId || !previousRef.pcieBusString
          ? "GPU passthrough reference is incomplete."
          : "GPU passthrough reference does not match a GPU on this host.";
    }
  });
}

function getNextAvailableIp(excludeServerId = null) {
  const subnet = getCurrentSubnet();
  if (!subnet) {
    return "";
  }

  const used = new Set(
    servers
      .filter((server) => server.id !== excludeServerId)
      .map((server) => parseIp(server.staticIp))
      .filter((ipNumber) => ipNumber !== null),
  );

  infrastructureNodes
    .filter((node) => node.id !== excludeServerId)
    .map((node) => parseIp(node.staticIp))
    .filter((ipNumber) => ipNumber !== null)
    .forEach((ipNumber) => used.add(ipNumber));

  const typedStartOctets = [0, 0, 0, 0];
  for (let index = 0; index < subnet.typedMatchOctets; index += 1) {
    typedStartOctets[index] = subnet.baseOctets[index];
  }

  const typedStart = typedStartOctets.reduce((total, octet) => total * 256 + octet, 0);
  const firstTypedCandidate = Math.max(subnet.firstUsable, typedStart);
  const firstTypedCandidateOctets = ipNumberToOctets(firstTypedCandidate);
  const firstCandidate =
    subnet.prefix < 31 && firstTypedCandidateOctets[3] === 0
      ? firstTypedCandidate + 1
      : firstTypedCandidate;
  const preferredStart = Math.min(firstCandidate + 9, subnet.lastUsable);
  for (let ipNumber = preferredStart; ipNumber <= subnet.lastUsable; ipNumber += 1) {
    if (!used.has(ipNumber) && isIpInSubnet(ipNumber, subnet)) {
      return formatIp(ipNumber);
    }
  }

  for (let ipNumber = firstCandidate; ipNumber < preferredStart; ipNumber += 1) {
    if (!used.has(ipNumber) && isIpInSubnet(ipNumber, subnet)) {
      return formatIp(ipNumber);
    }
  }

  return "";
}

function normalizeServer(server) {
  const safeServer = server && typeof server === "object" ? server : {};
  let nics = Array.isArray(safeServer.nics)
    ? safeServer.nics.map((nic) => normalizeNic(nic, { hostServerId: safeServer.id }))
    : [];
  if (!nics.length && typeof safeServer.staticIp === "string" && safeServer.staticIp.trim()) {
    nics = [makeManagementNic(safeServer.staticIp, safeServer.id)];
  }

  return {
    ...safeServer,
    staticIp: typeof safeServer.staticIp === "string" ? safeServer.staticIp : "",
    vmIds: Array.isArray(safeServer.vmIds) ? safeServer.vmIds : [],
    coresPerCpuChip: inferCoresPerCpuChip(safeServer),
    physicalGpuSlots: inferGpuSlotCount(safeServer),
    gpuDevices: Array.isArray(safeServer.gpuDevices)
      ? safeServer.gpuDevices.map((gpu) => normalizeGpuDevice(gpu, safeServer.id))
      : [],
    nics,
  };
}

function deriveVmCpuRam(vm) {
  const safeVm = vm && typeof vm === "object" ? vm : {};
  let cpu = typeof safeVm.cpu === "string" ? safeVm.cpu.trim() : "";
  let ram = typeof safeVm.ram === "string" ? safeVm.ram.trim() : "";

  if (!cpu || !ram) {
    const parts = String(safeVm.size || "")
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!cpu) {
      cpu = parts.find((part) => /cpu/i.test(part)) || parts[0] || "2 CPU";
    }
    if (!ram) {
      ram = parts.find((part) => /\b[MGT]B\b/i.test(part)) || parts[1] || "4 GB";
    }
  }

  return { cpu: cpu || "2 CPU", ram: ram || "4 GB" };
}

function normalizeVm(vm) {
  const safeVm = vm && typeof vm === "object" ? vm : {};
  const { cpu, ram } = deriveVmCpuRam(safeVm);
  const hostServerId = typeof safeVm.hostServerId === "string" ? safeVm.hostServerId : "";
  const normalizedNics = Array.isArray(safeVm.nics)
    ? safeVm.nics.map((nic) => normalizeNic(nic, { hostServerId, vmId: safeVm.id }))
    : [];
  return {
    ...safeVm,
    cpu,
    ram,
    size: `${cpu} / ${ram}`,
    hostServerId,
    gpuPassthrough: normalizeGpuPassthrough(safeVm.gpuPassthrough),
    gpuPassthroughWarning: typeof safeVm.gpuPassthroughWarning === "string" ? safeVm.gpuPassthroughWarning : "",
    nics: normalizedNics.length
      ? normalizedNics
      : [
          normalizeNic(
            {
              name: "Network Adapter 1",
              adapterType: "vm",
              connectedVirtualSwitchId: "",
              connectedVirtualSwitchName: "",
              ipAddresses: [],
            },
            { hostServerId, vmId: safeVm.id },
          ),
        ],
  };
}

function normalizeDesktopExtraIpDraft(ip) {
  return {
    id: typeof ip?.id === "string" && ip.id ? ip.id : `deskip-${crypto.randomUUID()}`,
    address: typeof ip?.address === "string" ? ip.address.trim() : "",
  };
}

function renderDesktopExtraIps() {
  if (!desktopExtraIpList) {
    return;
  }
  desktopExtraIpList.innerHTML = desktopExtraIpDrafts
    .map(
      (ip) => `
      <div class="desktop-extra-ip-row">
        <input value="${escapeHtml(ip.address)}" placeholder="e.g. 10.0.0.5" autocomplete="off" data-desktop-ip-id="${escapeHtml(ip.id)}" />
        <button type="button" class="danger-button desktop-extra-ip-remove" data-desktop-ip-remove="${escapeHtml(ip.id)}">Remove</button>
      </div>`,
    )
    .join("");
}

function normalizeInfrastructureNode(node) {
  return {
    ...node,
    staticIp: typeof node.staticIp === "string" ? node.staticIp : "",
    extraIps: Array.isArray(node.extraIps)
      ? node.extraIps.filter((ip) => typeof ip === "string" && ip.trim())
      : [],
  };
}

function normalizeSubnet(subnet, index) {
  const safeSubnet = subnet && typeof subnet === "object" ? subnet : {};
  const cidr = typeof safeSubnet.cidr === "string" ? safeSubnet.cidr.trim() : "";
  return {
    id: typeof safeSubnet.id === "string" && safeSubnet.id.trim() ? safeSubnet.id : `subnet-${index + 1}`,
    label:
      typeof safeSubnet.label === "string" && safeSubnet.label.trim()
        ? safeSubnet.label.trim()
        : `Subnet ${index + 1}`,
    cidr,
  };
}

// The network now keeps an ordered list of subnets. The first entry is the
// primary "server subnet" used by the existing host/desktop addressing logic,
// and additional entries let NIC IP addresses live on other networks.
function normalizeNetwork(rawNetwork, fallbackNetwork) {
  const safeNetwork = rawNetwork && typeof rawNetwork === "object" ? rawNetwork : {};
  const primaryCidr =
    typeof safeNetwork.serverSubnet === "string" && safeNetwork.serverSubnet.trim()
      ? safeNetwork.serverSubnet.trim()
      : fallbackNetwork.serverSubnet;

  let subnets = Array.isArray(safeNetwork.subnets)
    ? safeNetwork.subnets.map(normalizeSubnet).filter((subnet) => parseSubnet(subnet.cidr))
    : [];

  if (!subnets.length) {
    subnets = [{ id: "subnet-primary", label: "Server Subnet", cidr: primaryCidr }];
  } else if (!subnets.some((subnet) => subnet.cidr === primaryCidr) && parseSubnet(primaryCidr)) {
    subnets.unshift({ id: "subnet-primary", label: "Server Subnet", cidr: primaryCidr });
  }

  return {
    serverSubnet: subnets[0].cidr,
    subnets,
  };
}

function normalizeConfig(config) {
  const fallback = clone(DEFAULT_CONFIG);
  const safeConfig = config && typeof config === "object" ? config : fallback;
  const safeNetwork = safeConfig.network && typeof safeConfig.network === "object" ? safeConfig.network : fallback.network;

  return {
    servers: (Array.isArray(safeConfig.servers) ? safeConfig.servers : fallback.servers).map(normalizeServer),
    network: normalizeNetwork(safeNetwork, fallback.network),
    infrastructureNodes: Array.isArray(safeConfig.infrastructureNodes)
      ? safeConfig.infrastructureNodes.map(normalizeInfrastructureNode)
      : fallback.infrastructureNodes.map(normalizeInfrastructureNode),
    links: Array.isArray(safeConfig.links) ? safeConfig.links : fallback.links,
    vms: (Array.isArray(safeConfig.vms) ? safeConfig.vms : fallback.vms).map(normalizeVm),
  };
}

function applyConfig(config) {
  const normalized = normalizeConfig(config);
  servers = clone(normalized.servers);
  network = clone(normalized.network);
  infrastructureNodes = clone(normalized.infrastructureNodes);
  links = clone(normalized.links);
  vms = clone(normalized.vms);

  servers.forEach((server) => {
    if (!server.staticIp) {
      server.staticIp = getNextAvailableIp(server.id);
    }
  });

  const desktop = getInfrastructureNode("desktop");
  if (desktop && !desktop.staticIp) {
    desktop.staticIp = getNextAvailableIp();
  }

  syncGpuAssignments();
}

function serializeConfig() {
  syncGpuAssignments();
  return {
    servers,
    network,
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

function getVm(id) {
  return vms.find((vm) => vm.id === id);
}

function getInfrastructureNode(id) {
  return infrastructureNodes.find((node) => node.id === id);
}

function getConnectedLinkCount(nodeId) {
  return links.filter((link) => link.from === nodeId || link.to === nodeId).length;
}

function makeSwitchPorts(nodeId) {
  const activePorts = getConnectedLinkCount(nodeId);
  const totalPorts = Math.max(DEFAULT_SWITCH_PORTS, activePorts);

  return Array.from({ length: totalPorts }, (_, index) => {
    const className = index < activePorts ? ' class="is-active"' : "";
    return `<span${className}></span>`;
  }).join("");
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

function getNextVmName() {
  return `vm-${String(vms.length + 1).padStart(2, "0")}`;
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

function getHostedVmsForServer(serverId) {
  const server = getServer(serverId);
  if (!server) {
    return [];
  }

  return server.vmIds.map((vmId) => getVm(vmId)).filter(Boolean);
}

function makeGpuId(displayName) {
  const baseId = slugify(displayName) || "gpu-device";
  let id = baseId;
  let suffix = 2;
  const existingIds = new Set([...getAllGpuDevices(), ...gpuDraftDevices].map((gpu) => gpu.id));

  while (existingIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return id;
}

function clearGpuWarning() {
  gpuWarning.textContent = "";
  gpuWarning.classList.remove("is-visible");
}

function showGpuWarning(message) {
  gpuWarning.textContent = message;
  gpuWarning.classList.add("is-visible");
}

function getGpuFormData() {
  return {
    displayName: gpuDisplayNameInput.value.trim(),
    vendor: gpuVendorInput.value.trim(),
    model: gpuModelInput.value.trim(),
    pcieBusString: gpuPcieBusInput.value.trim(),
    bus: gpuBusInput.value.trim(),
    device: gpuDeviceInput.value.trim(),
    function: gpuFunctionInput.value.trim(),
    hypervLocationPath: gpuHypervPathInput.value.trim(),
    assignedVmId: gpuAssignedVmSelect.value,
    assignmentMode: "Hyper-V DDA",
    notes: gpuNotesInput.value.trim(),
  };
}

function fillGpuForm(gpu) {
  selectedGpuId = gpu.id;
  gpuDisplayNameInput.value = gpu.displayName;
  gpuVendorInput.value = gpu.vendor;
  gpuModelInput.value = gpu.model;
  gpuPcieBusInput.value = gpu.pcieBusString;
  gpuBusInput.value = gpu.bus || "";
  gpuDeviceInput.value = gpu.device || "";
  gpuFunctionInput.value = gpu.function || "";
  gpuHypervPathInput.value = gpu.hypervLocationPath || "";
  gpuAssignedVmSelect.value = gpu.assignedVmId || "";
  gpuNotesInput.value = gpu.notes || "";
  clearGpuWarning();
  renderGpuEditor();
}

function resetGpuForm() {
  selectedGpuId = null;
  gpuDisplayNameInput.value = "";
  gpuVendorInput.value = "NVIDIA";
  gpuModelInput.value = "";
  gpuPcieBusInput.value = "";
  gpuBusInput.value = "";
  gpuDeviceInput.value = "";
  gpuFunctionInput.value = "";
  gpuHypervPathInput.value = "";
  gpuAssignedVmSelect.value = "";
  gpuNotesInput.value = "";
  clearGpuWarning();
  renderGpuEditor();
}

function refreshGpuDraftFromSelectedServer() {
  const selectedServer = getServer(selectedServerId);
  gpuDraftDevices = selectedServer ? clone(selectedServer.gpuDevices || []) : [];
}

function renderGpuAssignmentOptions() {
  const hostedVms = getHostedVmsForServer(selectedServerId);
  const currentAssignedVmId = gpuAssignedVmSelect.value;
  gpuAssignedVmSelect.innerHTML = `<option value="">Select hosted VM</option>`;

  hostedVms.forEach((vm) => {
    const option = document.createElement("option");
    option.value = vm.id;
    option.textContent = vm.name;
    gpuAssignedVmSelect.appendChild(option);
  });

  if (currentAssignedVmId && !hostedVms.some((vm) => vm.id === currentAssignedVmId)) {
    const missingVm = getVm(currentAssignedVmId);
    const option = document.createElement("option");
    option.value = currentAssignedVmId;
    option.textContent = missingVm ? `${missingVm.name} (not on this server)` : `${currentAssignedVmId} (missing)`;
    gpuAssignedVmSelect.appendChild(option);
  }

  gpuAssignedVmSelect.value = currentAssignedVmId;
}

function makeGpuStatusText(gpu) {
  const assignedVm = getVm(gpu.assignedVmId);
  if (gpu.assignmentStatus === "assigned") {
    return `Assigned VM: ${assignedVm?.name || gpu.assignedVmName}`;
  }

  if (gpu.assignmentStatus === "missing-vm-link") {
    return "GPU requires a linked VM assignment.";
  }

  if (gpu.assignmentStatus === "conflict") {
    return "Conflict: duplicate PCIe path or VM is not hosted here.";
  }

  return "Unavailable: GPU or VM reference is missing.";
}

function renderGpuDraftList() {
  const slotCount = parseGpuSlotCount(serverGpuSlotsInput.value);
  const assignedCount = gpuDraftDevices.filter((gpu) => gpu.assignmentStatus === "assigned").length;
  const availableCount = Math.max(0, slotCount - assignedCount);
  const accounting = `
    <div class="gpu-accounting">
      <span><strong>${slotCount}</strong>Total</span>
      <span><strong>${assignedCount}</strong>Assigned</span>
      <span><strong>${availableCount}</strong>Left</span>
    </div>
  `;

  if (!gpuDraftDevices.length) {
    gpuDeviceList.innerHTML = `
      ${accounting}
      <div class="gpu-empty">No GPU passthrough assignments yet. Drop a VM onto this server to assign one.</div>
    `;
    return;
  }

  const validationDevices = getGpuDevicesForValidation();
  gpuDeviceList.innerHTML = `
    ${accounting}
    ${gpuDraftDevices
      .map((gpu) => {
        const normalizedGpu = normalizeGpuDevice(gpu, selectedServerId || gpu.hostServerId);
        normalizedGpu.assignmentStatus = getGpuAssignmentStatus(normalizedGpu, selectedServerId, validationDevices);
        return `
          <button class="gpu-device-row ${normalizedGpu.id === selectedGpuId ? "is-editing" : ""}" type="button" data-gpu-id="${escapeHtml(normalizedGpu.id)}">
            <strong>${escapeHtml(normalizedGpu.displayName || "GPU passthrough")}</strong>
            <span>${escapeHtml(normalizedGpu.pcieBusString || "PCIe path missing")}</span>
            <em class="gpu-status ${escapeHtml(normalizedGpu.assignmentStatus)}">${escapeHtml(getGpuStatusLabel(normalizedGpu.assignmentStatus))}</em>
            <small>${escapeHtml(makeGpuStatusText(normalizedGpu))}</small>
          </button>
        `;
      })
      .join("")}
  `;
}

function renderGpuEditor() {
  renderGpuAssignmentOptions();
  renderGpuDraftList();
  gpuSubmit.textContent = selectedGpuId ? "Save GPU" : "Add GPU";
  gpuDeleteButton.disabled = !selectedGpuId;

  const isEditingServer = Boolean(getServer(selectedServerId));
  const disabled = !isEditingServer;
  [
    gpuDisplayNameInput,
    gpuVendorInput,
    gpuModelInput,
    gpuPcieBusInput,
    gpuBusInput,
    gpuDeviceInput,
    gpuFunctionInput,
    gpuHypervPathInput,
    gpuAssignedVmSelect,
    gpuNotesInput,
    gpuSubmit,
    gpuNewButton,
    gpuDeleteButton,
  ].forEach((element) => {
    element.disabled = disabled || (element === gpuDeleteButton && !selectedGpuId);
  });

  if (disabled) {
    gpuWarning.textContent = "Save the server first. Then drag a VM onto it and assign a GPU location path during the drop.";
    gpuWarning.classList.add("is-visible");
  } else if (!gpuWarning.textContent) {
    clearGpuWarning();
  }
}

function saveGpuDraftDevice() {
  if (!selectedServerId || !getServer(selectedServerId)) {
    showGpuWarning("Save the server before adding Hyper-V GPU passthrough devices.");
    return;
  }

  const values = getGpuFormData();
  const assignedVm = getVm(values.assignedVmId);
  const hostedVmIds = new Set(getHostedVmsForServer(selectedServerId).map((vm) => vm.id));

  if (!values.displayName) {
    showGpuWarning("GPU requires a display name or model.");
    gpuDisplayNameInput.focus();
    return;
  }

  if (!values.pcieBusString) {
    showGpuWarning("GPU requires a PCIe bus string / location path.");
    gpuPcieBusInput.focus();
    return;
  }

  if (!values.assignedVmId) {
    showGpuWarning("GPU requires a linked VM assignment before it can be shown as assigned.");
    gpuAssignedVmSelect.focus();
    return;
  }

  if (!assignedVm || !hostedVmIds.has(values.assignedVmId)) {
    showGpuWarning("Assigned VM must be loaded on this same host server.");
    gpuAssignedVmSelect.focus();
    return;
  }

  const duplicatePcie = getGpuDevicesForValidation().some((gpu) => {
    return (
      gpu.id !== selectedGpuId &&
      String(gpu.pcieBusString || "").trim().toLowerCase() === values.pcieBusString.toLowerCase()
    );
  });

  if (duplicatePcie) {
    showGpuWarning("Another GPU already uses this PCIe bus string.");
    gpuPcieBusInput.focus();
    return;
  }

  const gpu = normalizeGpuDevice(
    {
      ...values,
      id: selectedGpuId || makeGpuId(values.displayName),
      hostServerId: selectedServerId,
      assignedVmName: assignedVm.name,
      assignmentStatus: "assigned",
    },
    selectedServerId,
  );

  if (selectedGpuId) {
    gpuDraftDevices = gpuDraftDevices.map((item) => (item.id === selectedGpuId ? gpu : item));
  } else {
    gpuDraftDevices.push(gpu);
    selectedGpuId = gpu.id;
  }

  clearGpuWarning();
  fillGpuForm(gpu);
}

function deleteGpuDraftDevice() {
  if (!selectedGpuId) {
    return;
  }

  gpuDraftDevices = gpuDraftDevices.filter((gpu) => gpu.id !== selectedGpuId);
  resetGpuForm();
}

function selectGpuDraftDevice(gpuId) {
  const gpu = gpuDraftDevices.find((item) => item.id === gpuId);
  if (gpu) {
    fillGpuForm(gpu);
  }
}

function getServerFormData() {
  const formData = new FormData(serverForm);
  const cpu = String(formData.get("cpu")).trim();

  return {
    name: String(formData.get("name")).trim(),
    staticIp: String(formData.get("staticIp")).trim(),
    cpu,
    coresPerCpuChip: parsePositiveInteger(formData.get("coresPerCpuChip"), parseCpuCount(cpu) || 1),
    ram: String(formData.get("ram")).trim(),
    storage: String(formData.get("storage")).trim(),
    gpus: String(formData.get("gpus")).trim(),
    physicalGpuSlots: parseGpuSlotCount(formData.get("gpuSlots")),
    nics: clone(serverNicDrafts),
    gpuDevices: clone(gpuDraftDevices),
  };
}

function fillServerForm(server) {
  serverForm.elements.name.value = server.name;
  serverForm.elements.staticIp.value = server.staticIp || getNextAvailableIp(server.id);
  serverForm.elements.cpu.value = server.cpu;
  serverCoresPerChipInput.value = inferCoresPerCpuChip(server);
  serverForm.elements.ram.value = server.ram;
  serverForm.elements.storage.value = server.storage;
  serverForm.elements.gpus.value = server.gpus;
  serverGpuSlotsInput.value = parseGpuSlotCount(server.physicalGpuSlots);
  serverNicDrafts = getServerNicDraftsFromServer(server);
  selectedServerNicId = getEditableServerNic(server)?.id || serverNicDrafts[0]?.id || null;
  gpuDraftDevices = clone(server.gpuDevices || []);
  selectedGpuId = null;
  setServerNicEditorError("");
  renderServerNicEditor();
  resetGpuForm();
}

function resetServerForm() {
  selectedServerId = null;
  selectedNodeId = null;
  joinMode = false;
  selectedGpuId = null;
  serverNicDrafts = [normalizeServerNicDraft({ name: "Management", adapterType: "management-os", ipAddresses: [] })];
  selectedServerNicId = serverNicDrafts[0].id;
  gpuDraftDevices = [];
  serverForm.elements.name.value = getNextServerName();
  serverForm.elements.staticIp.value = getNextAvailableIp();
  serverForm.elements.cpu.value = "24 vCPU";
  serverCoresPerChipInput.value = 12;
  serverForm.elements.ram.value = "96 GB";
  serverForm.elements.storage.value = "3 TB SSD";
  serverForm.elements.gpus.value = "None";
  serverGpuSlotsInput.value = 0;
  setServerNicEditorError("");
  renderServerNicEditor();
  resetGpuForm();
  render();
}

function getVmFormData() {
  const formData = new FormData(vmForm);
  const cpuCount = parsePositiveInteger(formData.get("cpu"), 1);
  const ramGb = parsePositiveInteger(formData.get("ram"), 1);
  const cpu = `${cpuCount} CPU`;
  const ram = `${ramGb} GB`;

  return {
    name: String(formData.get("name")).trim(),
    cpu,
    ram,
    size: `${cpu} / ${ram}`,
    nics: clone(vmNicDrafts),
  };
}

function fillVmForm(vm) {
  const { cpu, ram } = deriveVmCpuRam(vm);
  vmForm.elements.name.value = vm.name;
  vmForm.elements.cpu.value = parseCpuCount(cpu) || 2;
  vmForm.elements.ram.value = parseCpuCount(ram) || 4;
  vmNicDrafts = getVmNicDraftsFromVm(vm);
  setVmNicEditorError("");
  renderVmNicEditor();
}

function resetVmForm() {
  selectedVmId = null;
  vmForm.elements.name.value = getNextVmName();
  vmForm.elements.cpu.value = 2;
  vmForm.elements.ram.value = 4;
  vmNicDrafts = [normalizeVmNicDraft({ name: "Network Adapter 1", ipAddresses: [{}] })];
  setVmNicEditorError("");
  renderVmNicEditor();
  render();
}

function selectVmForEdit(vmId) {
  const vm = getVm(vmId);
  if (!vm) {
    return;
  }

  selectedVmId = vmId;
  fillVmForm(vm);
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

function getServerNicList(server) {
  return Array.isArray(server?.nics) ? server.nics : [];
}

function getVmNicList(vm) {
  return Array.isArray(vm?.nics) ? vm.nics : [];
}

function normalizeVmNicIpDraft(ip) {
  const safeIp = ip && typeof ip === "object" ? ip : {};
  return {
    id: typeof safeIp.id === "string" && safeIp.id.trim() ? safeIp.id.trim() : `ip-${crypto.randomUUID()}`,
    address: typeof safeIp.address === "string" ? safeIp.address.trim() : "",
    subnetMask: typeof safeIp.subnetMask === "string" ? safeIp.subnetMask.trim() : "255.255.255.0",
  };
}

function normalizeVmNicDraft(nic, { vmId = "", hostServerId = "" } = {}) {
  const safeNic = nic && typeof nic === "object" ? nic : {};
  const switchName =
    typeof safeNic.connectedVirtualSwitchName === "string" && safeNic.connectedVirtualSwitchName.trim()
      ? safeNic.connectedVirtualSwitchName.trim()
      : typeof safeNic.connectedVirtualSwitchId === "string" && safeNic.connectedVirtualSwitchId.trim()
        ? safeNic.connectedVirtualSwitchId.trim()
        : "";

  return {
    id: typeof safeNic.id === "string" && safeNic.id.trim() ? safeNic.id.trim() : `vmnic-${crypto.randomUUID()}`,
    vmId: typeof safeNic.vmId === "string" && safeNic.vmId.trim() ? safeNic.vmId.trim() : vmId,
    hostServerId:
      typeof safeNic.hostServerId === "string" && safeNic.hostServerId.trim() ? safeNic.hostServerId.trim() : hostServerId,
    name: typeof safeNic.name === "string" && safeNic.name.trim() ? safeNic.name.trim() : "Network Adapter",
    connectedVirtualSwitchId:
      typeof safeNic.connectedVirtualSwitchId === "string" && safeNic.connectedVirtualSwitchId.trim()
        ? safeNic.connectedVirtualSwitchId.trim()
        : switchName
          ? slugify(switchName)
          : "",
    connectedVirtualSwitchName: switchName,
    ipAddresses: Array.isArray(safeNic.ipAddresses)
      ? safeNic.ipAddresses.map(normalizeVmNicIpDraft)
      : [normalizeVmNicIpDraft({})],
    status: typeof safeNic.status === "string" && safeNic.status.trim() ? safeNic.status.trim() : "connected",
  };
}

function setVmNicEditorError(message = "") {
  if (vmNicError) {
    vmNicError.textContent = message;
  }
}

function getHostServerIdForVmEditing() {
  if (selectedVmId) {
    const selectedVm = getVm(selectedVmId);
    return selectedVm?.hostServerId || getVmHostServer(selectedVmId)?.id || "";
  }
  return "";
}

function getKnownHyperVSwitches(hostServerId = "", extraNics = []) {
  const names = new Set();
  const collect = (nic) => {
    const name = String(nic?.connectedVirtualSwitchName || nic?.connectedVirtualSwitchId || "").trim();
    if (name) {
      names.add(name);
    }
  };

  if (hostServerId) {
    vms
      .filter((vm) => vm.hostServerId === hostServerId)
      .flatMap((vm) => getVmNicList(vm))
      .forEach(collect);
  }

  extraNics.forEach(collect);

  if (!names.size) {
    names.add("vSwitch-Default");
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}

function renderVmNicEditor() {
  if (!vmNicList) {
    return;
  }

  if (!vmNicDrafts.length) {
    vmNicList.innerHTML = `<div class="server-nic-empty">No network adapters yet.</div>`;
    return;
  }

  const switchOptions = getKnownHyperVSwitches(getHostServerIdForVmEditing(), vmNicDrafts);
  const switchOptionsHtml = switchOptions.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");

  vmNicList.innerHTML = vmNicDrafts
    .map((nic, nicIndex) => {
      const nicSwitchName = nic.connectedVirtualSwitchName || "";
      const ipRows = nic.ipAddresses
        .map(
          (ip) => `
            <div class="vm-nic-ip-row" data-vm-nic-id="${escapeHtml(nic.id)}" data-vm-nic-ip-id="${escapeHtml(ip.id)}">
              <label>
                <span>Static IP</span>
                <input data-vm-nic-ip-field="address" data-vm-nic-id="${escapeHtml(nic.id)}" data-vm-nic-ip-id="${escapeHtml(ip.id)}" value="${escapeHtml(ip.address)}" placeholder="192.168.10.21" autocomplete="off" />
              </label>
              <label>
                <span>Subnet Mask</span>
                <input data-vm-nic-ip-field="subnetMask" data-vm-nic-id="${escapeHtml(nic.id)}" data-vm-nic-ip-id="${escapeHtml(ip.id)}" value="${escapeHtml(ip.subnetMask)}" placeholder="255.255.255.0" autocomplete="off" />
              </label>
              <button type="button" class="danger-button vm-nic-ip-remove" data-vm-nic-ip-remove="${escapeHtml(ip.id)}" data-vm-nic-id="${escapeHtml(nic.id)}">Remove</button>
            </div>
          `,
        )
        .join("");

      return `
        <div class="vm-nic-card">
          <div class="vm-nic-grid">
            <label>
              <span>NIC Name</span>
              <input data-vm-nic-field="name" data-vm-nic-id="${escapeHtml(nic.id)}" value="${escapeHtml(nic.name)}" placeholder="Network Adapter ${nicIndex + 1}" autocomplete="off" />
            </label>
            <label>
              <span>Hyper-V Virtual Switch</span>
              <input data-vm-nic-field="connectedVirtualSwitchName" data-vm-nic-id="${escapeHtml(nic.id)}" value="${escapeHtml(nicSwitchName)}" list="vm-switch-options-${escapeHtml(nic.id)}" placeholder="vSwitch-Prod" autocomplete="off" />
              <datalist id="vm-switch-options-${escapeHtml(nic.id)}">${switchOptionsHtml}</datalist>
            </label>
            <label>
              <span>Status</span>
              <select data-vm-nic-field="status" data-vm-nic-id="${escapeHtml(nic.id)}">
                <option value="connected"${nic.status === "connected" ? " selected" : ""}>connected</option>
                <option value="disconnected"${nic.status === "disconnected" ? " selected" : ""}>disconnected</option>
              </select>
            </label>
          </div>
          <div class="vm-nic-ip-list">
            ${ipRows || `<div class="server-nic-empty">No static IPs on this adapter.</div>`}
          </div>
          <div class="vm-nic-actions">
            <button type="button" class="secondary-button vm-nic-add-ip" data-vm-nic-ip-add="${escapeHtml(nic.id)}">+ Add IP</button>
            <button type="button" class="danger-button vm-nic-remove-adapter" data-vm-nic-remove="${escapeHtml(nic.id)}">Delete Adapter</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function addVmNicDraft() {
  const nextIndex = vmNicDrafts.length + 1;
  vmNicDrafts.push(
    normalizeVmNicDraft({
      name: `Network Adapter ${nextIndex}`,
      ipAddresses: [{}],
    }),
  );
  setVmNicEditorError("");
  renderVmNicEditor();
}

function updateVmNicDraft(nicId, field, value) {
  vmNicDrafts = vmNicDrafts.map((nic) => {
    if (nic.id !== nicId) {
      return nic;
    }

    if (field === "connectedVirtualSwitchName") {
      const switchName = String(value || "").trim();
      return {
        ...nic,
        connectedVirtualSwitchName: switchName,
        connectedVirtualSwitchId: switchName ? slugify(switchName) : "",
      };
    }

    return {
      ...nic,
      [field]: typeof value === "string" ? value.trim() : value,
    };
  });
  setVmNicEditorError("");
}

function removeVmNicDraft(nicId) {
  vmNicDrafts = vmNicDrafts.filter((nic) => nic.id !== nicId);
  setVmNicEditorError("");
  renderVmNicEditor();
}

function addVmNicIpDraft(nicId) {
  vmNicDrafts = vmNicDrafts.map((nic) =>
    nic.id === nicId
      ? {
          ...nic,
          ipAddresses: [
            ...nic.ipAddresses,
            normalizeVmNicIpDraft({}),
          ],
        }
      : nic,
  );
  setVmNicEditorError("");
  renderVmNicEditor();
}

function updateVmNicIpDraft(nicId, ipId, field, value) {
  vmNicDrafts = vmNicDrafts.map((nic) =>
    nic.id === nicId
      ? {
          ...nic,
          ipAddresses: nic.ipAddresses.map((ip) => {
            if (ip.id !== ipId) {
              return ip;
            }

            return {
              ...ip,
              [field]: typeof value === "string" ? value.trim() : value,
            };
          }),
        }
      : nic,
  );
  setVmNicEditorError("");
}

function removeVmNicIpDraft(nicId, ipId) {
  vmNicDrafts = vmNicDrafts.map((nic) =>
    nic.id === nicId
      ? {
          ...nic,
          ipAddresses: nic.ipAddresses.filter((ip) => ip.id !== ipId),
        }
      : nic,
  );
  setVmNicEditorError("");
  renderVmNicEditor();
}

function getVmNicDraftsFromVm(vm) {
  const vmId = vm?.id || "";
  const hostServerId = vm?.hostServerId || getVmHostServer(vmId)?.id || "";
  const drafts = getVmNicList(vm).map((nic) =>
    normalizeVmNicDraft(
      {
        ...nic,
        connectedVirtualSwitchName: nic.connectedVirtualSwitchName || nic.connectedVirtualSwitchId,
      },
      { vmId, hostServerId },
    ),
  );
  return drafts.length ? drafts : [normalizeVmNicDraft({ name: "Network Adapter 1", ipAddresses: [{}] }, { vmId, hostServerId })];
}

function buildVmNicsFromDrafts(vmId, hostServerId, nicDrafts) {
  const drafts = nicDrafts.length
    ? nicDrafts
    : [normalizeVmNicDraft({ name: "Network Adapter 1", ipAddresses: [{}] }, { vmId, hostServerId })];

  return drafts.map((draft, index) =>
    normalizeNic(
      {
        id: draft.id,
        vmId,
        hostServerId,
        name: draft.name || `Network Adapter ${index + 1}`,
        adapterType: "vm",
        connectedVirtualSwitchId: draft.connectedVirtualSwitchId,
        connectedVirtualSwitchName: draft.connectedVirtualSwitchName,
        status: draft.status,
        ipAddresses: draft.ipAddresses.map((ip) =>
          normalizeIpAddress({
            id: ip.id,
            address: ip.address,
            version: "IPv4",
            cidrPrefix: maskToPrefix(ip.subnetMask),
            subnetMask: ip.subnetMask,
            assignmentType: "static",
          }),
        ),
      },
      { hostServerId, vmId },
    ),
  );
}

// Flatten every adapter in the topology with its owning server/VM context so the
// IP management view and validation engine can reason about NICs uniformly.
function getAllNicEntries() {
  const entries = [];
  servers.forEach((server) => {
    getServerNicList(server).forEach((nic) => {
      entries.push({ nic, server, vm: null });
    });
  });
  vms.forEach((vm) => {
    getVmNicList(vm).forEach((nic) => {
      const host = getVmHostServer(vm.id) || getServer(nic.hostServerId);
      entries.push({ nic, server: host || null, vm });
    });
  });
  return entries;
}

function getAllIpEntries() {
  const rows = [];
  getAllNicEntries().forEach(({ nic, server, vm }) => {
    nic.ipAddresses.forEach((ip) => {
      rows.push({ ip, nic, server, vm });
    });
  });
  return rows;
}

function getIpEffectivePrefix(ip) {
  if (Number.isInteger(ip.cidrPrefix)) {
    return ip.cidrPrefix;
  }
  if (ip.subnetMask) {
    return maskToPrefix(ip.subnetMask);
  }
  return null;
}

function getIpv4Network(address, prefix) {
  const ipNumber = parseIp(address);
  if (ipNumber === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return null;
  }
  const blockSize = 2 ** (32 - prefix);
  return Math.floor(ipNumber / blockSize) * blockSize;
}

function formatIpCidr(ip) {
  if (!ip.address) {
    return "";
  }
  const prefix = getIpEffectivePrefix(ip);
  return Number.isInteger(prefix) ? `${ip.address}/${prefix}` : ip.address;
}

function emptyNetworkValidation() {
  return { ipMessages: new Map(), nicMessages: new Map(), warnings: [] };
}

let networkValidation = emptyNetworkValidation();

// Run every networking validation rule once per render and cache the results so
// cards, the IP table, and the warnings banner all share the same findings.
function computeNetworkValidation() {
  const result = emptyNetworkValidation();
  const ipEntries = getAllIpEntries();
  const nicEntries = getAllNicEntries();

  const addIpMessage = (ipId, message) => {
    if (!result.ipMessages.has(ipId)) {
      result.ipMessages.set(ipId, []);
    }
    result.ipMessages.get(ipId).push(message);
  };
  const addNicMessage = (nicId, message) => {
    if (!result.nicMessages.has(nicId)) {
      result.nicMessages.set(nicId, []);
    }
    result.nicMessages.get(nicId).push(message);
  };

  // Rule: warn if the same static IP appears on multiple VMs/servers/adapters.
  const staticAddressOwners = new Map();
  ipEntries.forEach(({ ip, nic, server, vm }) => {
    if (!ip.address) {
      return;
    }
    const key = ip.address.toLowerCase();
    if (!staticAddressOwners.has(key)) {
      staticAddressOwners.set(key, []);
    }
    staticAddressOwners.get(key).push({ ip, nic, server, vm });
  });

  ipEntries.forEach(({ ip, nic, server, vm }) => {
    const ownerLabel = vm ? `VM ${vm.name}` : server ? server.name : "Unassigned";

    if (ip.address && parseIp(ip.address) === null) {
      addIpMessage(ip.id, "Invalid IPv4 address");
    }

    if (ip.address) {
      const owners = staticAddressOwners.get(ip.address.toLowerCase()) || [];
      if (owners.length > 1) {
        addIpMessage(ip.id, "Duplicate static IP used on multiple VM/server adapters");
      }
    }

    if (result.ipMessages.has(ip.id)) {
      const detail = `${ownerLabel} · ${nic.name} · ${ip.address || "no address"}`;
      result.ipMessages.get(ip.id).forEach((message) => {
        result.warnings.push(`${detail}: ${message}`);
      });
    }
  });

  nicEntries.forEach(({ nic, server, vm }) => {
    const ownerLabel = vm ? `VM ${vm.name}` : server ? server.name : "Unassigned";

    if (vm || nic.adapterType === "vm") {
      const expectedHostServerId = vm?.hostServerId || getVmHostServer(vm?.id || "")?.id || "";
      const hostServer = expectedHostServerId ? getServer(expectedHostServerId) : null;
      const hostSwitches = new Set(
        getServerNicList(hostServer)
          .filter((hostNic) => hostNic.adapterType === "virtual-switch")
          .map((hostNic) => hostNic.name)
          .filter(Boolean),
      );
      const connectedSwitchName = nic.connectedVirtualSwitchName || nic.connectedVirtualSwitchId;

      // Rule: a VM NIC must connect to a Hyper-V virtual switch on the same host server.
      if (!connectedSwitchName) {
        addNicMessage(nic.id, "VM network adapter is not connected to a Hyper-V virtual switch");
      }
      if (expectedHostServerId && nic.hostServerId && nic.hostServerId !== expectedHostServerId) {
        addNicMessage(nic.id, "VM network adapter switch is not on the VM host server");
      }
      if (hostSwitches.size && connectedSwitchName && !hostSwitches.has(connectedSwitchName)) {
        addNicMessage(nic.id, `Hyper-V virtual switch \"${connectedSwitchName}\" is not defined on host ${hostServer?.name}`);
      }

      // Rule: warn if a VM network adapter has no static IP address.
      if (!nic.ipAddresses.length) {
        addNicMessage(nic.id, "VM network adapter has no static IP address");
      }

    }

    if (result.nicMessages.has(nic.id)) {
      result.nicMessages.get(nic.id).forEach((message) => {
        result.warnings.push(`${ownerLabel} · ${nic.name}: ${message}`);
      });
    }
  });

  return result;
}

function getNicStatus(nic) {
  const messages = [];
  if (networkValidation.nicMessages.has(nic.id)) {
    messages.push(...networkValidation.nicMessages.get(nic.id));
  }
  nic.ipAddresses.forEach((ip) => {
    if (networkValidation.ipMessages.has(ip.id)) {
      messages.push(...networkValidation.ipMessages.get(ip.id));
    }
  });
  return { level: messages.length ? "warning" : "ok", messages };
}

function getIpStatus(ip, nic) {
  const messages = [];
  if (networkValidation.ipMessages.has(ip.id)) {
    messages.push(...networkValidation.ipMessages.get(ip.id));
  }
  if (nic && networkValidation.nicMessages.has(nic.id)) {
    messages.push(...networkValidation.nicMessages.get(nic.id));
  }
  return { level: messages.length ? "warning" : "ok", messages };
}

function makeNicIpLine(ip, nic) {
  const status = getIpStatus(ip, nic);
  const addressText = ip.address ? `${ip.address} / ${ip.subnetMask || "—"}` : "no address";
  const title = status.messages.length ? ` title="${escapeHtml(status.messages.join(" · "))}"` : "";
  return `
    <li class="nic-ip ${status.level === "warning" ? "is-warning" : ""}"${title}>
      <span class="nic-ip-addr">${escapeHtml(addressText)}</span>
    </li>
  `;
}

function getNicTypeLabel(adapterType) {
  switch (adapterType) {
    case "management-os":
      return "Mgmt OS";
    case "virtual-switch":
      return "vSwitch";
    case "physical":
      return "Physical";
    case "vm":
      return "VM";
    default:
      return adapterType || "NIC";
  }
}

function makeNicBlock(nic) {
  const status = getNicStatus(nic);
  const meta = [];
  if (nic.macAddress) {
    meta.push({ label: escapeHtml(nic.macAddress), tone: "neutral" });
  }
  const switchName = nic.connectedVirtualSwitchName || nic.connectedVirtualSwitchId;
  if (switchName) {
    meta.push({ label: `Switch ${escapeHtml(switchName)}`, tone: "accent" });
  }

  const ipList = nic.ipAddresses.length
    ? `<ul class="nic-ip-list">${nic.ipAddresses.map((ip) => makeNicIpLine(ip, nic)).join("")}</ul>`
    : `<div class="nic-empty">No IP addresses</div>`;

  return `
    <div class="nic-block ${status.level === "warning" ? "is-warning" : ""}">
      <div class="nic-head">
        <strong>${escapeHtml(nic.name)}</strong>
        <span class="nic-type">${escapeHtml(getNicTypeLabel(nic.adapterType))}</span>
      </div>
      ${meta.length ? `<div class="nic-meta">${meta.map((item) => `<span class="nic-meta-chip ${item.tone}">${item.label}</span>`).join("")}</div>` : ""}
      ${ipList}
    </div>
  `;
}

function makeServerNics(server) {
  const nics = getServerNicList(server);
  if (!nics.length) {
    return "";
  }
  return `
    <div class="nic-panel">
      <strong class="nic-panel-title">NICs</strong>
      ${nics.map((nic) => makeNicBlock(nic)).join("")}
    </div>
  `;
}

function getServerVmNicEntries(serverId) {
  return getHostedVmsForServer(serverId).flatMap((vm) =>
    getVmNicList(vm).map((nic) => ({ vm, nic })),
  );
}

function makeServerHyperVSwitches(server) {
  const vmNics = getServerVmNicEntries(server.id).filter(({ nic }) => nic.connectedVirtualSwitchId || nic.connectedVirtualSwitchName);
  if (!vmNics.length) {
    return "";
  }

  const switchMap = new Map();
  vmNics.forEach(({ vm, nic }) => {
    const switchName = nic.connectedVirtualSwitchName || nic.connectedVirtualSwitchId || "Unassigned";
    if (!switchMap.has(switchName)) {
      switchMap.set(switchName, []);
    }
    switchMap.get(switchName).push({ vm, nic });
  });

  return `
    <div class="nic-panel">
      <strong class="nic-panel-title">Hyper-V Switches</strong>
      ${[...switchMap.entries()]
        .map(
          ([switchName, members]) => `
            <div class="nic-block">
              <div class="nic-head">
                <strong>${escapeHtml(switchName)}</strong>
                <span class="nic-type">vSwitch</span>
              </div>
              <ul class="nic-ip-list">
                ${members
                  .map(({ vm, nic }) => {
                    const firstIp = nic.ipAddresses.find((ip) => ip.address)?.address || "—";
                    return `<li class="nic-ip"><span class="nic-ip-addr">${escapeHtml(`${vm.name} / ${nic.name} / ${firstIp}`)}</span></li>`;
                  })
                  .join("")}
              </ul>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function makeServerVmTopology(server) {
  const rows = getServerVmNicEntries(server.id)
    .flatMap(({ vm, nic }) =>
      nic.ipAddresses.length
        ? nic.ipAddresses.map((ip) => ({ vm, nic, ip }))
        : [{ vm, nic, ip: null }],
    )
    .map(({ vm, nic, ip }) => {
      const switchName = nic.connectedVirtualSwitchName || nic.connectedVirtualSwitchId || "Unassigned vSwitch";
      const ipLabel = ip?.address || "No static IP";
      return `<div class="vm-topology-row">${escapeHtml(`${vm.name} -> ${nic.name} -> ${switchName} -> ${server.name} (${ipLabel})`)}</div>`;
    });

  if (!rows.length) {
    return "";
  }

  return `
    <div class="vm-topology-panel">
      <strong>VM -> VM NIC -> vSwitch -> Host</strong>
      ${rows.join("")}
    </div>
  `;
}

function makeVmNics(vm) {
  const nics = getVmNicList(vm);
  if (!nics.length) {
    return "";
  }

  const nicSummary = nics
    .map((nic) => {
      const staticIps = nic.ipAddresses.length
        ? nic.ipAddresses
            .map((ip) => `<li>${escapeHtml(`${ip.address || "—"} / ${ip.subnetMask || "—"}`)}</li>`)
            .join("")
        : "<li>No static IPs</li>";

      return `
        <div class="nic-block">
          <div class="nic-head">
            <strong>${escapeHtml(nic.name || "Network Adapter")}</strong>
            <span class="nic-type">VM NIC</span>
          </div>
          <div class="nic-meta">
            <span class="nic-meta-chip accent">Switch ${escapeHtml(nic.connectedVirtualSwitchName || nic.connectedVirtualSwitchId || "—")}</span>
          </div>
          <div class="vm-nic-summary">
            <strong>Static IPs</strong>
            <ul>${staticIps}</ul>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="vm-nic-panel">
      <strong>Network Adapters</strong>
      ${nicSummary}
    </div>
  `;
}

function makeServerGpuAssignments(server) {
  const gpuDevices = Array.isArray(server.gpuDevices) ? server.gpuDevices : [];
  const assignedDevices = gpuDevices.filter((gpu) => gpu.assignedVmId || gpu.assignmentStatus);

  if (!assignedDevices.length) {
    return "";
  }

  return `
    <div class="gpu-assignment-panel">
      <strong>GPU Passthrough</strong>
      ${
        assignedDevices
          .map((gpu) => {
            const assignedVm = getVm(gpu.assignedVmId);
            const status = gpu.assignmentStatus || getGpuAssignmentStatus(gpu, server.id);
            return `
              <div class="gpu-assignment ${escapeHtml(status)}">
                <span>${escapeHtml(gpu.displayName || gpu.model || "GPU passthrough")}</span>
                <small>PCIe: ${escapeHtml(gpu.pcieBusString || "Missing")}</small>
                <small>Assigned VM: ${escapeHtml(assignedVm?.name || gpu.assignedVmName || "Missing")}</small>
                <small>Mode: ${escapeHtml(gpu.assignmentMode || "Hyper-V DDA")}</small>
                <em>${escapeHtml(getGpuStatusLabel(status))}</em>
              </div>
            `;
          })
          .join("")
      }
    </div>
  `;
}

function makeServerStatusStrip(server) {
  const topology = getServerCpuTopology(server);
  const numaOpportunityCount = topology.physicalChips || 1;
  const totalSlots = parseGpuSlotCount(server.physicalGpuSlots);
  const assignedCount = getAssignedGpuCount(server);
  const gpuLabel = totalSlots ? `${assignedCount}/${totalSlots}` : "None";
  const gpuClass = totalSlots && assignedCount >= totalSlots ? "is-full" : "";

  return `
    <div class="server-status-strip" aria-label="Server resource summary">
      <span title="${escapeHtml(server.cpu)} total">
        <b>CPU</b>
        <em>${escapeHtml(topology.totalCpu || server.cpu)}</em>
      </span>
      <span title="1 NUMA = ${escapeHtml(topology.numaCpuPerNode)} CPU">
        <b>NUMA</b>
        <em>${escapeHtml(numaOpportunityCount)}x${escapeHtml(topology.numaCpuPerNode)}</em>
      </span>
      <span class="${escapeHtml(gpuClass)}" title="${escapeHtml(assignedCount)} assigned GPU passthrough slots out of ${escapeHtml(totalSlots)}">
        <b>GPU</b>
        <em>${escapeHtml(gpuLabel)}</em>
      </span>
    </div>
  `;
}

function makeServerDetailLine(server) {
  const details = [server.ram, server.storage, server.gpus].filter((detail) => String(detail || "").trim());

  if (!details.length) {
    return "";
  }

  return `
    <div class="server-detail-line">
      ${details.map((detail) => `<span>${escapeHtml(detail)}</span>`).join("")}
    </div>
  `;
}

function makeVmNumaDetails(vm) {
  const guidance = getVmNumaGuidance(vm);
  if (!guidance) {
    return "";
  }

  return `
    <div class="vm-numa-detail ${guidance.crossesNuma ? "is-risk" : ""}">
      <strong>NUMA</strong>
      <span>${escapeHtml(guidance.vmCpuCount)} CPU / ${escapeHtml(guidance.numaCpuPerNode)} per node</span>
      <span>${escapeHtml(guidance.numaNodesNeeded)} NUMA node${guidance.numaNodesNeeded === 1 ? "" : "s"}${guidance.crossesNuma ? " - possible crossing" : ""}</span>
    </div>
  `;
}

function makeVmGpuDetails(vm) {
  const assignedGpus = getGpuDevicesForVm(vm.id).filter((gpu) => gpu.assignmentStatus === "assigned");
  if (!assignedGpus.length && !vm.gpuPassthrough?.enabled) {
    return "";
  }

  if (!assignedGpus.length && vm.gpuPassthroughWarning) {
    return `
      <div class="vm-gpu-detail is-warning">
        <strong>GPU Passthrough</strong>
        <span>${escapeHtml(vm.gpuPassthroughWarning)}</span>
        <span>PCIe: ${escapeHtml(vm.gpuPassthrough.pcieBusString || "Missing")}</span>
      </div>
    `;
  }

  return assignedGpus
    .map((gpu) => {
      const hostServer = getServer(gpu.hostServerId);
      return `
        <div class="vm-gpu-detail">
          <strong>GPU Passthrough</strong>
          <span>${escapeHtml(gpu.displayName || gpu.model || "Unnamed GPU")}</span>
          <span>PCIe: ${escapeHtml(gpu.pcieBusString)}</span>
          <span>Host: ${escapeHtml(hostServer?.name || gpu.hostServerId || "Missing")}</span>
          <span>Mode: ${escapeHtml(gpu.assignmentMode || "Hyper-V DDA")}</span>
        </div>
      `;
    })
    .join("");
}

function makeVmCard(vm) {
  const card = document.createElement("div");
  const numaGuidance = getVmNumaGuidance(vm);
  card.className = "vm-card";
  card.draggable = true;
  card.dataset.vmId = vm.id;
  if (vm.id === selectedVmId) {
    card.classList.add("is-editing");
  }
  if (getGpuDevicesForVm(vm.id).some((gpu) => gpu.assignmentStatus === "assigned")) {
    card.classList.add("has-gpu-passthrough");
  }
  if (vm.gpuPassthroughWarning) {
    card.classList.add("has-gpu-warning");
  }
  if (numaGuidance?.crossesNuma) {
    card.classList.add("has-numa-risk");
  }
  card.innerHTML = `
    <strong>${escapeHtml(vm.name)}</strong>
    <span>${escapeHtml(vm.size)}</span>
    ${makeVmNumaDetails(vm)}
    ${makeVmGpuDetails(vm)}
    ${makeVmNics(vm)}
  `;
  card.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", vm.id);
    event.dataTransfer.effectAllowed = "move";
  });
  card.addEventListener("click", (event) => {
    event.stopPropagation();
    selectVmForEdit(vm.id);
  });
  return card;
}

function moveVmToServer(vmId, serverId) {
  const previousHost = getVmHostServer(vmId);
  const isMovingToDifferentServer = serverId !== "pool" && previousHost?.id !== serverId;
  const isUnloadingVm = serverId === "pool";

  if (isMovingToDifferentServer || isUnloadingVm) {
    releaseGpuAssignmentsForVm(vmId);
  }

  servers.forEach((server) => {
    server.vmIds = server.vmIds.filter((id) => id !== vmId);
  });

  if (serverId !== "pool") {
    const targetServer = getServer(serverId);
    if (targetServer) {
      targetServer.vmIds.push(vmId);
    }
  }

  syncGpuAssignments();
  refreshGpuDraftFromSelectedServer();
  render();
  saveConfig();

  if (isMovingToDifferentServer) {
    openGpuAssignmentDialog(vmId, serverId);
  }
}

function attachDropZone(element, serverId) {
  element.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    element.closest(".topology-node")?.classList.add("is-drop-target");
    if (serverId === "pool") {
      element.classList.add("is-drop-target");
    }
  });

  element.addEventListener("dragleave", () => {
    element.closest(".topology-node")?.classList.remove("is-drop-target");
    if (serverId === "pool") {
      element.classList.remove("is-drop-target");
    }
  });

  element.addEventListener("drop", (event) => {
    event.preventDefault();
    const vmId = event.dataTransfer.getData("text/plain");
    element.closest(".topology-node")?.classList.remove("is-drop-target");
    if (serverId === "pool") {
      element.classList.remove("is-drop-target");
    }
    if (!getVm(vmId)) {
      return;
    }
    moveVmToServer(vmId, serverId);
  });
}

function makeNodeElement(node) {
  const element = document.createElement("article");
  element.className = `topology-node ${node.type}-topology`;
  element.dataset.nodeId = node.id;
  element.style.left = `${node.x}%`;
  element.style.top = `${node.y}%`;

  const server = node.type === "server" ? getServer(node.id) : null;
  const ipValidationMessage = server
    ? getIpValidationMessage(server.staticIp)
    : node.type === "desktop"
      ? getIpValidationMessage(node.staticIp)
      : "";

  if (ipValidationMessage) {
    element.classList.add("has-invalid-ip");
  }

  if (node.id === selectedNodeId) {
    element.classList.add("is-selected");
  }

  if (node.id === selectedServerId) {
    element.classList.add("is-editing");
  }

  if (node.type === "server") {
    element.innerHTML = `
      <div class="mini-rack" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="node-content">
        <div class="node-title">
          <span>Server</span>
          <strong>${escapeHtml(server.name)}</strong>
        </div>
        ${makeIpChip(server.staticIp)}
        ${makeServerStatusStrip(server)}
        ${makeServerDetailLine(server)}
        ${makeServerGpuAssignments(server)}
        ${makeServerNics(server)}
        ${makeServerHyperVSwitches(server)}
        ${makeServerVmTopology(server)}
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
        ${makeSwitchPorts(node.id)}
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
        <strong>${escapeHtml(node.name)}</strong>
      </div>
      ${makeIpChip(node.staticIp, "desktop-ip-chip")}
      ${(node.extraIps || []).map((ip) => makeIpChip(ip, "desktop-ip-chip", true)).join("")}
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

function renderIpManagement() {
  if (!ipTableBody) {
    return;
  }

  const rows = getAllIpEntries();
  // Prepend desktop IPs (primary + extras) as simple rows
  const desktopNode = getInfrastructureNode("desktop");
  const desktopRows = desktopNode
    ? [
        ...(desktopNode.staticIp ? [{ address: desktopNode.staticIp, role: "primary" }] : []),
        ...(desktopNode.extraIps || []).map((addr) => ({ address: addr, role: "" })),
      ].map((ipInfo) => ({ ipInfo, node: desktopNode }))
    : [];

  if (ipWarnings) {
    if (networkValidation.warnings.length) {
      ipWarnings.classList.add("has-warnings");
      ipWarnings.innerHTML = `
        <strong>${networkValidation.warnings.length} networking warning${
          networkValidation.warnings.length === 1 ? "" : "s"
        }</strong>
        <ul>${networkValidation.warnings.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul>
      `;
    } else {
      ipWarnings.classList.remove("has-warnings");
      ipWarnings.innerHTML = `<span class="ip-warnings-clear">No networking warnings detected.</span>`;
    }
  }

  if (ipCount) {
    ipCount.textContent = rows.length + desktopRows.length;
  }

  if (!rows.length && !desktopRows.length) {
    ipTableBody.innerHTML = `<tr><td colspan="9" class="ip-empty">No IP addresses assigned yet.</td></tr>`;
    return;
  }

  const desktopRowsHtml = desktopRows
    .map(
      ({ ipInfo, node }) => `
        <tr>
          <td>${escapeHtml(ipInfo.address)}</td>
          <td>—</td>
          <td>${escapeHtml(node.name)}</td>
          <td>desktop</td>
          <td>—</td>
          <td>—</td>
          <td>${escapeHtml(ipInfo.role)}</td>
          <td>static</td>
          <td><span class="ip-status is-ok">OK</span></td>
        </tr>`,
    )
    .join("");

  ipTableBody.innerHTML =
    desktopRowsHtml +
    rows
    .map(({ ip, nic, server, vm }) => {
      const status = getIpStatus(ip, nic);
      const subnetText = describeIpSubnet(ip);
      const statusCell = status.messages.length
        ? `<span class="ip-status is-warning" title="${escapeHtml(status.messages.join(" · "))}">Warning</span>`
        : `<span class="ip-status is-ok">OK</span>`;

      return `
        <tr class="${status.level === "warning" ? "is-warning" : ""}">
          <td>${escapeHtml(ip.address || "—")}</td>
          <td>${escapeHtml(subnetText)}</td>
          <td>${escapeHtml(nic.name)}</td>
          <td>${escapeHtml(nic.adapterType)}</td>
          <td>${escapeHtml(server ? server.name : "—")}</td>
          <td>${escapeHtml(vm ? vm.name : "—")}</td>
          <td>${escapeHtml(ip.role || "—")}</td>
          <td>${escapeHtml(ip.assignmentType)}</td>
          <td>${statusCell}</td>
        </tr>
      `;
    })
    .join("");
}

function renderCounters() {
  serverCount.textContent = servers.length;
  linkCount.textContent = links.length;
  vmCount.textContent = vms.length;
}

function renderNetworkSettings() {
  const savedSubnet = network.serverSubnet || DEFAULT_SERVER_SUBNET;
  if (document.activeElement !== subnetInput) {
    subnetInput.value = savedSubnet;
  }

  const desktop = getInfrastructureNode("desktop");
  if (desktop && document.activeElement !== desktopIpInput) {
    desktopIpInput.value = desktop.staticIp || getNextAvailableIp("desktop");
  }
  renderDesktopExtraIps();

  const subnet = parseSubnet(subnetInput.value || savedSubnet);

  if (!subnet) {
    subnetSummary.textContent = "Invalid subnet";
    subnetSummary.classList.add("is-error");
    return;
  }

  subnetSummary.innerHTML = `
    <span><strong>CIDR</strong>${escapeHtml(subnet.cidr)}</span>
    <span><strong>Mask</strong>${escapeHtml(subnet.mask)}</span>
    <span><strong>IPs</strong>${escapeHtml(formatTypedSubnetHint(subnet))}</span>
  `;
  subnetSummary.classList.remove("is-error");
  renderSubnetList();
}

function renderSubnetList() {
  if (!subnetList) {
    return;
  }

  const subnets = getNetworkSubnets();
  if (!subnets.length) {
    subnetList.innerHTML = `<div class="subnet-empty">No subnets defined yet.</div>`;
    return;
  }

  subnetList.innerHTML = subnets
    .map((subnet, index) => {
      const parsed = parseSubnet(subnet.cidr);
      const isPrimary = index === 0;
      const cidrText = parsed ? parsed.cidr : subnet.cidr || "—";
      const action = isPrimary
        ? `<span class="subnet-tag">Primary</span>`
        : `<button type="button" class="subnet-remove" data-subnet-id="${escapeHtml(subnet.id)}" aria-label="Remove ${escapeHtml(subnet.label)}">Remove</button>`;
      return `
        <div class="subnet-row ${parsed ? "" : "is-error"}">
          <div class="subnet-row-main">
            <strong>${escapeHtml(subnet.label)}</strong>
            <span>${escapeHtml(cidrText)}</span>
          </div>
          ${action}
        </div>
      `;
    })
    .join("");
}

function addSubnet(label, cidrText) {
  const parsed = parseSubnet(cidrText);
  if (!parsed) {
    return "Use CIDR like 10.0.20.0/24 or mask style like 10.0.20.0 255.255.255.0.";
  }

  if (!Array.isArray(network.subnets)) {
    network.subnets = [];
  }

  if (network.subnets.some((subnet) => parseSubnet(subnet.cidr)?.cidr === parsed.cidr)) {
    return "That subnet is already defined.";
  }

  const baseId = slugify(label) || `subnet-${network.subnets.length + 1}`;
  let id = baseId;
  let suffix = 2;
  while (network.subnets.some((subnet) => subnet.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  network.subnets.push({
    id,
    label: label.trim() || `Subnet ${network.subnets.length + 1}`,
    cidr: cidrText.trim(),
  });
  render();
  saveConfig();
  return "";
}

function removeSubnet(subnetId) {
  if (!Array.isArray(network.subnets)) {
    return;
  }
  const index = network.subnets.findIndex((subnet) => subnet.id === subnetId);
  if (index <= 0) {
    return;
  }
  network.subnets.splice(index, 1);
  render();
  saveConfig();
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
  renderServerNicEditor();
}

function renderVmFormState() {
  const selectedVm = getVm(selectedVmId);
  const isEditing = Boolean(selectedVm);

  if (!isEditing && selectedVmId) {
    selectedVmId = null;
  }

  vmFormState.textContent = isEditing
    ? `Editing ${selectedVm.name}`
    : "Create a new VM";
  vmSubmit.textContent = isEditing ? "Save VM" : "Add VM";
  deleteVmButton.disabled = !isEditing;
  renderVmNicEditor();
}

function render() {
  syncGpuAssignments();
  networkValidation = computeNetworkValidation();
  renderCounters();
  renderNetworkSettings();
  renderJoinState();
  renderServerFormState();
  renderVmFormState();
  renderGpuEditor();
  renderNodes();
  requestAnimationFrame(renderLinks);
  renderVmPool();
  renderIpManagement();
}

function createVm(values) {
  const name = values.name;
  const baseId = slugify(name) || `vm-${vms.length + 1}`;
  let id = baseId;
  let suffix = 2;

  while (getVm(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const hostServerId = "";
  vms.push({
    id,
    name,
    cpu: values.cpu,
    ram: values.ram,
    size: values.size,
    hostServerId,
    nics: buildVmNicsFromDrafts(id, hostServerId, values.nics),
  });
  selectedVmId = id;
}

function updateSelectedVm(values) {
  const vm = getVm(selectedVmId);
  if (!vm) {
    selectedVmId = null;
    createVm(values);
    return;
  }

  vm.name = values.name;
  vm.cpu = values.cpu;
  vm.ram = values.ram;
  vm.size = values.size;
  const hostServerId = vm.hostServerId || getVmHostServer(vm.id)?.id || "";
  vm.nics = buildVmNicsFromDrafts(vm.id, hostServerId, values.nics);
}

function saveVm(event) {
  event.preventDefault();
  const values = getVmFormData();

  if (!values.nics.length) {
    setVmNicEditorError("A VM must have at least one network adapter.");
    return;
  }

  for (const nic of values.nics) {
    if (!String(nic.connectedVirtualSwitchName || "").trim()) {
      setVmNicEditorError(`Set a Hyper-V virtual switch for ${nic.name || "a network adapter"}.`);
      return;
    }
    if (!nic.ipAddresses.length) {
      setVmNicEditorError(`${nic.name || "A network adapter"} must have at least one static IP address.`);
      return;
    }

    for (const ip of nic.ipAddresses) {
      if (ip.address && parseIp(ip.address) === null) {
        setVmNicEditorError(`Invalid static IP address: ${ip.address}`);
        return;
      }
      if (ip.subnetMask && maskToPrefix(ip.subnetMask) === null) {
        setVmNicEditorError(`Invalid subnet mask on ${nic.name || "network adapter"}.`);
        return;
      }
    }
  }

  setVmNicEditorError("");

  if (selectedVmId) {
    updateSelectedVm(values);
  } else {
    createVm(values);
  }

  render();
  saveConfig();
}

function deleteSelectedVm() {
  const vmIndex = vms.findIndex((vm) => vm.id === selectedVmId);
  if (vmIndex === -1) {
    return;
  }

  const deletedId = selectedVmId;
  vms.splice(vmIndex, 1);
  servers.forEach((server) => {
    server.vmIds = server.vmIds.filter((vmId) => vmId !== deletedId);
  });
  syncGpuAssignments();
  resetVmForm();
  saveConfig();
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
    staticIp: values.staticIp || getNextAvailableIp(),
    cpu: values.cpu,
    coresPerCpuChip: values.coresPerCpuChip,
    ram: values.ram,
    storage: values.storage,
    gpus: values.gpus,
    physicalGpuSlots: values.physicalGpuSlots,
    gpuDevices: values.gpuDevices.map((gpu) => normalizeGpuDevice(gpu, id)),
    nics: buildServerNicsFromDrafts(id, values.staticIp || getNextAvailableIp(), values.nics),
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
  server.staticIp = values.staticIp || getNextAvailableIp(server.id);
  server.cpu = values.cpu;
  server.coresPerCpuChip = values.coresPerCpuChip;
  server.ram = values.ram;
  server.storage = values.storage;
  server.gpus = values.gpus;
  server.physicalGpuSlots = values.physicalGpuSlots;
  server.gpuDevices = values.gpuDevices.map((gpu) => normalizeGpuDevice(gpu, server.id));
  server.nics = buildServerNicsFromDrafts(server.id, server.staticIp, values.nics);
}

function saveServer(event) {
  event.preventDefault();
  const values = getServerFormData();
  const staticIpNumber = values.staticIp ? parseIp(values.staticIp) : null;
  const ipValidationMessage = getIpValidationMessage(values.staticIp);
  const desktop = getInfrastructureNode("desktop");
  const duplicateIp = values.staticIp
    ? servers.some((server) => server.id !== selectedServerId && server.staticIp === values.staticIp) ||
      desktop?.staticIp === values.staticIp
    : false;
  const allServerIpAddresses = [values.staticIp, ...values.nics.flatMap((nic) => nic.ipAddresses.map((ip) => ip.address))]
    .map((address) => String(address || "").trim())
    .filter(Boolean);
  const seenServerIps = new Set();
  const duplicateFormIp = allServerIpAddresses.find((address) => {
    const normalized = address.toLowerCase();
    if (seenServerIps.has(normalized)) {
      return true;
    }
    seenServerIps.add(normalized);
    return false;
  });
  const draftIpEntries = values.nics.flatMap((nic) => nic.ipAddresses.map((ip) => ({ nic, ip })));
  const duplicateExistingNicIp = draftIpEntries.find(({ ip }) => {
    if (!ip.address) {
      return false;
    }
    return getAllIpEntries().some(({ ip: existingIp, server, vm }) => {
      if (!existingIp.address || existingIp.assignmentType !== "static") {
        return false;
      }
      if (vm) {
        return existingIp.address === ip.address;
      }
      return server?.id !== selectedServerId && existingIp.address === ip.address;
    });
  });
  const invalidAdditionalIp = draftIpEntries.find(({ ip }) => ip.address && parseIp(ip.address) === null);
  const invalidAdditionalSubnet = draftIpEntries.find(({ ip }) => {
    if (!ip.address) {
      return false;
    }
    const probeIp = normalizeIpAddress({
      address: ip.address,
      version: "IPv4",
      assignmentType: "static",
      subnetId: ip.subnetId,
      role: "",
    });
    return Boolean(getNicIpSubnetMessage(probeIp));
  });
  if (values.staticIp && staticIpNumber === null) {
    serverForm.elements.staticIp.setCustomValidity("Use a valid IPv4 address.");
    serverForm.reportValidity();
    return;
  }

  if (values.staticIp && ipValidationMessage) {
    serverForm.elements.staticIp.setCustomValidity(ipValidationMessage);
    serverForm.reportValidity();
    return;
  }

  if (duplicateIp) {
    serverForm.elements.staticIp.setCustomValidity("Use an IP address that is not already assigned.");
    serverForm.reportValidity();
    return;
  }

  if (duplicateFormIp) {
    setServerNicEditorError("Each server IP must be unique on the form.");
    return;
  }

  if (invalidAdditionalIp) {
    setServerNicEditorError(`Use a valid IPv4 address for ${invalidAdditionalIp.ip.address || "the NIC IP"}.`);
    return;
  }

  if (duplicateExistingNicIp) {
    setServerNicEditorError(`IP address ${duplicateExistingNicIp.ip.address} is already assigned elsewhere.`);
    return;
  }

  if (invalidAdditionalSubnet) {
    const probeIp = normalizeIpAddress({
      address: invalidAdditionalSubnet.ip.address,
      version: "IPv4",
      assignmentType: "static",
      subnetId: invalidAdditionalSubnet.ip.subnetId,
      role: "",
    });
    setServerNicEditorError(getNicIpSubnetMessage(probeIp));
    return;
  }

  if (values.coresPerCpuChip < 1) {
    serverCoresPerChipInput.setCustomValidity("Use at least 1 core per physical CPU chip.");
    serverForm.reportValidity();
    return;
  }

  const assignedGpuCount = values.gpuDevices.filter((gpu) => gpu.assignmentStatus === "assigned").length;
  if (values.physicalGpuSlots < assignedGpuCount) {
    serverGpuSlotsInput.setCustomValidity("GPU slots cannot be lower than the assigned passthrough GPU count.");
    serverForm.reportValidity();
    return;
  }

  serverForm.elements.staticIp.setCustomValidity("");
  serverCoresPerChipInput.setCustomValidity("");
  serverGpuSlotsInput.setCustomValidity("");
  setServerNicEditorError("");

  if (selectedServerId) {
    updateSelectedServer(values);
  } else {
    createServer(values);
  }

  syncGpuAssignments();
  render();
  saveConfig();
}

function saveNetworkSettings(event) {
  event.preventDefault();
  const formData = new FormData(networkForm);
  const subnetText = String(formData.get("serverSubnet")).trim();
  const desktopIp = String(formData.get("desktopIp")).trim();
  const subnet = parseSubnet(subnetText);
  const desktopIpNumber = desktopIp ? parseIp(desktopIp) : null;
  const desktopIpValidationMessage = desktopIp && subnet ? getIpValidationMessage(desktopIp, subnet) : "";
  const duplicateDesktopIp = desktopIp
    ? servers.some((server) => server.staticIp === desktopIp)
    : false;

  if (!subnet) {
    subnetInput.setCustomValidity("Use CIDR like 192.168.1.0/24 or mask style like 192.168.1.0 255.255.255.0.");
    networkForm.reportValidity();
    renderNetworkSettings();
    return;
  }

  if (desktopIp && desktopIpNumber === null) {
    desktopIpInput.setCustomValidity("Use a valid IPv4 address.");
    networkForm.reportValidity();
    return;
  }

  if (desktopIp && desktopIpValidationMessage) {
    desktopIpInput.setCustomValidity(desktopIpValidationMessage);
    networkForm.reportValidity();
    return;
  }

  if (duplicateDesktopIp) {
    desktopIpInput.setCustomValidity("Use an IP address that is not already assigned to a server.");
    networkForm.reportValidity();
    return;
  }

  subnetInput.setCustomValidity("");
  desktopIpInput.setCustomValidity("");
  network.serverSubnet = subnetText;
  if (!Array.isArray(network.subnets) || !network.subnets.length) {
    network.subnets = [{ id: "subnet-primary", label: "Server Subnet", cidr: subnetText }];
  } else {
    network.subnets[0] = { ...network.subnets[0], cidr: subnetText };
  }
  const desktop = getInfrastructureNode("desktop");
  if (desktop) {
    desktop.staticIp = desktopIp || getNextAvailableIp("desktop");
    desktop.extraIps = desktopExtraIpDrafts.map((ip) => ip.address).filter(Boolean);
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
vmForm.addEventListener("submit", saveVm);
networkForm.addEventListener("submit", saveNetworkSettings);
if (addVmNicButton) {
  addVmNicButton.addEventListener("click", addVmNicDraft);
}
if (vmNicList) {
  vmNicList.addEventListener("input", (event) => {
    const target = event.target;
    const nicId = target.dataset.vmNicId;
    const field = target.dataset.vmNicField;
    const ipId = target.dataset.vmNicIpId;
    const ipField = target.dataset.vmNicIpField;

    if (nicId && field) {
      updateVmNicDraft(nicId, field, target.value);
      return;
    }

    if (nicId && ipId && ipField) {
      updateVmNicIpDraft(nicId, ipId, ipField, target.value);
    }
  });
  vmNicList.addEventListener("change", (event) => {
    const target = event.target;
    const nicId = target.dataset.vmNicId;
    const field = target.dataset.vmNicField;
    const ipId = target.dataset.vmNicIpId;
    const ipField = target.dataset.vmNicIpField;

    if (nicId && field) {
      updateVmNicDraft(nicId, field, target.value);
      renderVmNicEditor();
      return;
    }

    if (nicId && ipId && ipField) {
      updateVmNicIpDraft(nicId, ipId, ipField, target.value);
    }
  });
  vmNicList.addEventListener("click", (event) => {
    const removeNicButton = event.target.closest("[data-vm-nic-remove]");
    if (removeNicButton) {
      removeVmNicDraft(removeNicButton.dataset.vmNicRemove);
      return;
    }

    const addIpButton = event.target.closest("[data-vm-nic-ip-add]");
    if (addIpButton) {
      addVmNicIpDraft(addIpButton.dataset.vmNicIpAdd);
      return;
    }

    const removeIpButton = event.target.closest("[data-vm-nic-ip-remove]");
    if (removeIpButton) {
      removeVmNicIpDraft(removeIpButton.dataset.vmNicId, removeIpButton.dataset.vmNicIpRemove);
    }
  });
}
if (addServerNicButton) {
  addServerNicButton.addEventListener("click", addServerNicDraft);
}
if (addServerNicIpButton) {
  addServerNicIpButton.addEventListener("click", () => {
    const nic = getSelectedServerNicDraft();
    if (!nic) {
      return;
    }
    addServerNicIpDraft(nic.id);
  });
}
if (serverNicList) {
  serverNicList.addEventListener("input", (event) => {
    const target = event.target;
    const nicId = target.dataset.serverNicId;
    const field = target.dataset.serverNicField;
    if (!nicId || !field) {
      return;
    }
    updateServerNicDraft(nicId, field, target.value);
  });
  serverNicList.addEventListener("change", (event) => {
    const target = event.target;
    const nicId = target.dataset.serverNicId;
    const field = target.dataset.serverNicField;
    if (!nicId || !field) {
      return;
    }
    updateServerNicDraft(nicId, field, target.value);
  });
  serverNicList.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-server-nic-remove]");
    if (removeButton) {
      removeServerNicDraft(removeButton.dataset.serverNicRemove);
      return;
    }
    const selectButton = event.target.closest("[data-server-nic-select]");
    if (selectButton && !event.target.closest("input, select, button")) {
      selectServerNicDraft(selectButton.dataset.serverNicSelect);
    }
  });
}
if (serverNicIpList) {
  serverNicIpList.addEventListener("input", (event) => {
    const target = event.target;
    const nicId = target.dataset.serverNicId;
    const ipId = target.dataset.serverNicIpId;
    const field = target.dataset.serverNicIpField;
    if (!nicId || !ipId || !field) {
      return;
    }
    updateServerNicIpDraft(nicId, ipId, field, target.value);
  });
  serverNicIpList.addEventListener("change", (event) => {
    const target = event.target;
    const nicId = target.dataset.serverNicId;
    const ipId = target.dataset.serverNicIpId;
    const field = target.dataset.serverNicIpField;
    if (!nicId || !ipId || !field) {
      return;
    }
    updateServerNicIpDraft(nicId, ipId, field, target.value);
  });
  serverNicIpList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-server-nic-ip-remove]");
    if (!button) {
      return;
    }
    removeServerNicIpDraft(button.dataset.serverNicId, button.dataset.serverNicIpRemove);
  });
}
if (subnetAddForm) {
  subnetAddForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = addSubnet(subnetAddLabel.value, subnetAddCidr.value);
    if (subnetAddError) {
      subnetAddError.textContent = message;
    }
    if (!message) {
      subnetAddLabel.value = "";
      subnetAddCidr.value = "";
    }
  });
}
if (subnetAddCidr) {
  subnetAddCidr.addEventListener("input", () => {
    if (subnetAddError) {
      subnetAddError.textContent = "";
    }
  });
}
if (subnetList) {
  subnetList.addEventListener("click", (event) => {
    const button = event.target.closest(".subnet-remove");
    if (button) {
      removeSubnet(button.dataset.subnetId);
    }
  });
}
subnetInput.addEventListener("input", () => {
  subnetInput.setCustomValidity("");
  renderNetworkSettings();
});
desktopIpInput.addEventListener("input", () => {
  desktopIpInput.setCustomValidity("");
});
if (addDesktopIpButton) {
  addDesktopIpButton.addEventListener("click", () => {
    desktopExtraIpDrafts.push(normalizeDesktopExtraIpDraft({}));
    renderDesktopExtraIps();
  });
}
if (desktopExtraIpList) {
  desktopExtraIpList.addEventListener("input", (event) => {
    const input = event.target.closest("[data-desktop-ip-id]");
    if (input) {
      const id = input.dataset.desktopIpId;
      desktopExtraIpDrafts = desktopExtraIpDrafts.map((ip) =>
        ip.id === id ? { ...ip, address: input.value } : ip,
      );
    }
  });
  desktopExtraIpList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-desktop-ip-remove]");
    if (button) {
      desktopExtraIpDrafts = desktopExtraIpDrafts.filter(
        (ip) => ip.id !== button.dataset.desktopIpRemove,
      );
      renderDesktopExtraIps();
    }
  });
}
serverForm.elements.staticIp.addEventListener("input", () => {
  serverForm.elements.staticIp.setCustomValidity("");
});
serverCoresPerChipInput.addEventListener("input", () => {
  serverCoresPerChipInput.setCustomValidity("");
});
serverGpuSlotsInput.addEventListener("input", () => {
  serverGpuSlotsInput.setCustomValidity("");
  renderGpuEditor();
});
gpuSubmit.addEventListener("click", saveGpuDraftDevice);
gpuNewButton.addEventListener("click", resetGpuForm);
gpuDeleteButton.addEventListener("click", deleteGpuDraftDevice);
gpuDeviceList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-gpu-id]");
  if (row) {
    selectGpuDraftDevice(row.dataset.gpuId);
  }
});
gpuAssignmentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  assignPendingGpuPassthrough(gpuDialogLocationInput.value.trim());
});
gpuDialogSkip.addEventListener("click", closeGpuAssignmentDialog);
gpuAssignmentDialog.addEventListener("click", (event) => {
  if (event.target === gpuAssignmentDialog) {
    closeGpuAssignmentDialog();
  }
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !gpuAssignmentDialog.hidden) {
    closeGpuAssignmentDialog();
  }
});
newServerButton.addEventListener("click", resetServerForm);
deleteServerButton.addEventListener("click", deleteSelectedServer);
newVmButton.addEventListener("click", resetVmForm);
deleteVmButton.addEventListener("click", deleteSelectedVm);
const focusToggle = document.querySelector("#focus-toggle");
const workspace = document.querySelector(".workspace");
focusToggle.addEventListener("click", () => {
  const collapsed = workspace.classList.toggle("sidebars-collapsed");
  focusToggle.setAttribute("aria-pressed", String(collapsed));
  focusToggle.querySelector("span").textContent = collapsed ? "Show Panels" : "Expand View";
  workspace.addEventListener("transitionend", function onEnd(e) {
    if (e.propertyName === "grid-template-columns") {
      workspace.removeEventListener("transitionend", onEnd);
      renderLinks();
    }
  });
});

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
  const desktop = getInfrastructureNode("desktop");
  desktopExtraIpDrafts = (desktop?.extraIps || []).map((addr) =>
    normalizeDesktopExtraIpDraft({ address: addr }),
  );
  resetServerForm();
  resetVmForm();
  render();
});
