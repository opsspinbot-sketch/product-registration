// Ultra-Modern Enterprise Responsive SVG Charts (Zero Dependencies)

export function renderBarChart(containerId, data, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const width = options.width || 520;
  const height = options.height || 220;
  const padding = 32;

  if (!data || data.length === 0) {
    container.innerHTML = '<div style="padding:40px; text-align:center; color:#94a3b8; font-size:13px;">No analytics volume data available</div>';
    return;
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const barWidth = (chartWidth / data.length) * 0.45;
  const gap = (chartWidth / data.length) * 0.55;

  let barsSvg = '';
  data.forEach((d, i) => {
    const barHeight = Math.max((d.value / maxValue) * chartHeight, 6);
    const x = padding + i * (barWidth + gap) + gap / 2;
    const y = height - padding - barHeight;

    barsSvg += `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="url(#barGradient)" filter="drop-shadow(0 4px 6px rgba(118,211,0,0.15))">
        <title>${d.label}: ${d.value} submissions</title>
      </rect>
      <text x="${x + barWidth / 2}" y="${height - 8}" text-anchor="middle" font-size="11" font-weight="700" fill="#64748b">${d.label}</text>
      <text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#0f172a">${d.value}</text>
    `;
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; display: block; overflow: visible;">
      <defs>
        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#76D300" />
          <stop offset="100%" stop-color="#529400" />
        </linearGradient>
      </defs>
      <!-- Grid lines -->
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#f1f5f9" stroke-width="2"/>
      <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" stroke="#f8fafc" stroke-dasharray="4 4" stroke-width="1.5"/>
      ${barsSvg}
    </svg>
  `;
}

export function renderDonutChart(containerId, data, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const size = options.size || 220;
  const radius = size / 2 - 26;
  const strokeWidth = options.strokeWidth || 22;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  const total = data.reduce((acc, d) => acc + d.value, 0) || 0;
  let accumulatedAngle = 0;

  const colors = options.colors || ['#76D300', '#f59e0b', '#ef4444', '#64748b'];

  const uniqueId = 'donut_' + Math.random().toString(36).substr(2, 6);

  let slicesSvg = '';
  data.forEach((d, i) => {
    const percentage = total > 0 ? d.value / total : 0;
    const dashArray = `${percentage * circumference} ${circumference}`;
    const dashOffset = -accumulatedAngle * circumference;
    const color = d.color || colors[i % colors.length];

    slicesSvg += `
      <circle cx="${center}" cy="${center}" r="${radius}" 
              fill="transparent" 
              stroke="${color}" 
              stroke-width="${strokeWidth}" 
              stroke-linecap="round"
              stroke-dasharray="${dashArray}" 
              stroke-dashoffset="${dashOffset}"
              transform="rotate(-90 ${center} ${center})"
              style="transition: all 0.3s ease; cursor: pointer;"
              onmouseenter="
                this.style.strokeWidth='${strokeWidth + 6}px'; 
                document.getElementById('${uniqueId}_num').textContent='${d.value}'; 
                document.getElementById('${uniqueId}_lbl').textContent='${d.label} (${Math.round(percentage * 100)}%)';
              "
              onmouseleave="
                this.style.strokeWidth='${strokeWidth}px'; 
                document.getElementById('${uniqueId}_num').textContent='${total}'; 
                document.getElementById('${uniqueId}_lbl').textContent='TOTAL REGS';
              ">
        <title>${d.label}: ${d.value} (${Math.round(percentage * 100)}%)</title>
      </circle>
    `;
    accumulatedAngle += percentage;
  });

  let legendHtml = '<div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 18px;">';
  data.forEach((d, i) => {
    const color = d.color || colors[i % colors.length];
    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
    legendHtml += `
      <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #334155; background: #f8fafc; padding: 6px 14px; border-radius: 20px; border: 1px solid #e2e8f0; cursor: default; transition: var(--transition);"
           onmouseenter="this.style.borderColor='${color}'; this.style.transform='translateY(-1px)';"
           onmouseleave="this.style.borderColor='#e2e8f0'; this.style.transform='translateY(0)';">
        <span style="width: 10px; height: 10px; border-radius: 50%; background-color: ${color}; box-shadow: 0 0 8px ${color}88;"></span>
        <span>${d.label}</span>
        <span style="color: #64748b; font-weight:600;">(${d.value} • ${pct}%)</span>
      </div>
    `;
  });
  legendHtml += '</div>';

  container.innerHTML = `
    <div style="text-align: center; padding: 4px 0;">
      <svg viewBox="0 0 ${size} ${size}" style="width: ${size}px; height: ${size}px; display: inline-block; overflow: visible;">
        <circle cx="${center}" cy="${center}" r="${radius}" fill="transparent" stroke="#f1f5f9" stroke-width="${strokeWidth}"/>
        ${slicesSvg}
        <text id="${uniqueId}_num" x="${center}" y="${center - 2}" text-anchor="middle" font-size="24" font-weight="900" fill="#0f172a" style="transition: all 0.2s;">${total}</text>
        <text id="${uniqueId}_lbl" x="${center}" y="${center + 16}" text-anchor="middle" font-size="10" font-weight="800" fill="#94a3b8" letter-spacing="0.08em" text-transform="uppercase" style="transition: all 0.2s;">TOTAL REGS</text>
      </svg>
      ${legendHtml}
    </div>
  `;
}
