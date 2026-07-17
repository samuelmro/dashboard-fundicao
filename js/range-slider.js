// Slider de intervalo (dois cabos) em vanilla JS, sem dependências.
// window.createRangeSlider(container, {min, max, valueMin, valueMax, onChange}) -> {getValue, setBounds}

(function () {
  'use strict';

  function createRangeSlider(container, opts) {
    const state = { min: opts.min, max: opts.max, lo: opts.valueMin, hi: opts.valueMax };
    const onChange = opts.onChange || function () {};

    container.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'range-slider';
    const track = document.createElement('div'); track.className = 'rs-track';
    const range = document.createElement('div'); range.className = 'rs-range';
    const hLo = document.createElement('div'); hLo.className = 'rs-handle'; hLo.tabIndex = 0; hLo.setAttribute('role', 'slider');
    const hHi = document.createElement('div'); hHi.className = 'rs-handle'; hHi.tabIndex = 0; hHi.setAttribute('role', 'slider');
    root.appendChild(track); root.appendChild(range); root.appendChild(hLo); root.appendChild(hHi);
    container.appendChild(root);

    function pct(v) { return (v - state.min) / (state.max - state.min || 1); }

    function render() {
      const pLo = pct(state.lo) * 100, pHi = pct(state.hi) * 100;
      hLo.style.left = pLo + '%';
      hHi.style.left = pHi + '%';
      range.style.left = pLo + '%';
      range.style.right = (100 - pHi) + '%';
      hLo.setAttribute('aria-valuenow', state.lo);
      hHi.setAttribute('aria-valuenow', state.hi);
    }

    function valueFromClientX(clientX) {
      const rect = root.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return Math.round(state.min + p * (state.max - state.min));
    }

    function dragHandle(handle, which) {
      const onMove = (e) => {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let v = valueFromClientX(clientX);
        if (which === 'lo') v = Math.min(v, state.hi);
        else v = Math.max(v, state.lo);
        state[which] = v;
        render();
        onChange(state.lo, state.hi);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        handle.setPointerCapture && handle.setPointerCapture(e.pointerId);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
      handle.addEventListener('keydown', (e) => {
        let v = state[which];
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v -= 1;
        else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v += 1;
        else return;
        e.preventDefault();
        if (which === 'lo') v = Math.min(Math.max(v, state.min), state.hi);
        else v = Math.max(Math.min(v, state.max), state.lo);
        state[which] = v;
        render();
        onChange(state.lo, state.hi);
      });
    }
    dragHandle(hLo, 'lo');
    dragHandle(hHi, 'hi');

    track.addEventListener('pointerdown', (e) => {
      const v = valueFromClientX(e.clientX);
      if (Math.abs(v - state.lo) <= Math.abs(v - state.hi)) { state.lo = Math.min(v, state.hi); }
      else { state.hi = Math.max(v, state.lo); }
      render();
      onChange(state.lo, state.hi);
    });

    render();

    return {
      getValue() { return { lo: state.lo, hi: state.hi }; },
      setBounds(min, max, lo, hi) {
        state.min = min; state.max = max; state.lo = lo; state.hi = hi;
        render();
      }
    };
  }

  window.createRangeSlider = createRangeSlider;
})();
