const button = document.querySelector('button');
const status = document.querySelector('[role="status"]');
if (button && status) {
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = '正在整理…';
    try {
      const window = await chrome.windows.getCurrent();
      const result = await chrome.runtime.sendMessage({ type: 'organize-window', windowId: window.id });
      status.textContent = result?.ok ? '整理完成' : '整理失败，请重试';
    } catch {
      status.textContent = '整理失败，请重试';
    } finally {
      button.disabled = false;
    }
  });
}
