

export function setPipelineStep(step) {
  // step: 0 = reset all, 1-5 = light up through that step
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('pipeStep' + i);
    if (!el) continue;
    el.classList.remove('lit', 'active');
    if (i < step) el.classList.add('lit');
    else if (i === step) el.classList.add('lit', 'active');
  }
}

export function resetPipelineSteps() {
  setPipelineStep(0);
}

export function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}