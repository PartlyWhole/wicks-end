/** Cursor tooltip: UI hover text takes priority over world hover text. */
export class Tooltip {
  private el: HTMLDivElement;
  private ui: string | null = null;
  private world = '';
  private last = '';

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'tooltip';
    document.body.appendChild(this.el);
    window.addEventListener('mousemove', (e) => {
      this.el.style.left = `${e.clientX}px`;
      this.el.style.top = `${e.clientY}px`;
    });
  }

  setUI(html: string | null): void {
    this.ui = html;
    this.flush();
  }

  setWorld(html: string): void {
    this.world = html;
    this.flush();
  }

  private flush(): void {
    const html = this.ui ?? this.world;
    if (html === this.last) return;
    this.last = html;
    this.el.innerHTML = html;
  }
}
