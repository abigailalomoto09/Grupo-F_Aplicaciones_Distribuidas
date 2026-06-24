const summaryCards = document.getElementById("summaryCards");
const recentLogs = document.getElementById("recentLogs");
const eventSummary = document.getElementById("eventSummary");
const generatedAt = document.getElementById("generatedAt");
const refreshBtn = document.getElementById("refreshBtn");
const demoBtn = document.getElementById("demoBtn");

function formatDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(date);
}

function levelBadgeClass(level) {
  switch (level) {
    case "TRACE":
      return "bg-slate-400/15 text-slate-200 border-slate-400/30";
    case "FATAL":
      return "bg-red-600/20 text-red-200 border-red-600/40";
    case "ERROR":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    case "WARN":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "DEBUG":
      return "bg-slate-500/15 text-slate-300 border-slate-500/30";
    default:
      return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
  }
}

function renderCards(summary) {
  const cards = [
    { label: "Total logs", value: summary.total },
    { label: "Trace", value: summary.byLevel.TRACE },
    { label: "Debug", value: summary.byLevel.DEBUG },
    { label: "Info", value: summary.byLevel.INFO },
    { label: "Warn", value: summary.byLevel.WARN },
    { label: "Error", value: summary.byLevel.ERROR },
    { label: "Fatal", value: summary.byLevel.FATAL }
  ];

  summaryCards.innerHTML = cards.map((card) => `
    <article class="bg-slate-900/80 border border-white/10 rounded-3xl p-6 shadow-lg">
      <p class="text-slate-400 text-sm uppercase tracking-[0.25em]">${card.label}</p>
      <h3 class="text-4xl font-black mt-3 text-cyan-400">${card.value || 0}</h3>
    </article>
  `).join("");
}

function renderRecentLogs(recent) {
  recentLogs.innerHTML = recent.length
    ? recent.map((log) => `
      <tr class="align-top">
        <td class="py-4 pr-4 text-slate-400 whitespace-nowrap">${formatDate(log.createdAt)}</td>
        <td class="py-4 pr-4">
          <span class="inline-flex px-3 py-1 rounded-full border text-xs font-black ${levelBadgeClass(log.level)}">${log.level}</span>
        </td>
        <td class="py-4 pr-4 font-bold text-white">${log.event}</td>
        <td class="py-4 pr-4 text-slate-300">${log.message}</td>
      </tr>
    `).join("")
    : `
      <tr>
        <td colspan="4" class="py-8 text-center text-slate-400">Todavía no hay logs guardados.</td>
      </tr>
    `;
}

function renderEventSummary(byEvent) {
  eventSummary.innerHTML = byEvent.length
    ? byEvent.map((item) => `
      <div class="flex items-center justify-between bg-slate-950/70 border border-white/5 rounded-2xl px-4 py-3">
        <span class="text-slate-200 font-medium">${item.event}</span>
        <span class="text-cyan-400 font-black">${item.count}</span>
      </div>
    `).join("")
    : `<p class="text-slate-400">Aún no se han registrado eventos.</p>`;
}

async function loadLogs() {
  try {
    const response = await fetch("/api/logs/summary?limit=25");
    const data = await response.json();

    generatedAt.textContent = `Generado: ${formatDate(data.generatedAt)}`;
    renderCards(data);
    renderRecentLogs(data.recent || []);
    renderEventSummary(data.byEvent || []);
  } catch (error) {
    summaryCards.innerHTML = "";
    recentLogs.innerHTML = `
      <tr>
        <td colspan="4" class="py-8 text-center text-red-300">
          No fue posible cargar los logs.
        </td>
      </tr>
    `;
    eventSummary.innerHTML = `<p class="text-red-300">Error al consultar el resumen.</p>`;
    console.error(error);
  }
}

async function generateDemoLogs() {
  if (demoBtn) {
    demoBtn.disabled = true;
    demoBtn.textContent = "Generando...";
  }

  try {
    await fetch("/api/logs/demo");
    await loadLogs();
  } catch (error) {
    console.error(error);
  } finally {
    if (demoBtn) {
      demoBtn.disabled = false;
      demoBtn.textContent = "Generar logs de prueba";
    }
  }
}

if (refreshBtn) {
  refreshBtn.addEventListener("click", loadLogs);
}

if (demoBtn) {
  demoBtn.addEventListener("click", generateDemoLogs);
}

loadLogs();
setInterval(loadLogs, 8000);
