import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
} from '@angular/core';

@Component({
  selector: 'app-firma-canvas',
  standalone: true,
  template: `
    <div>
      <canvas
        #canvasEl
        style="width: 340px; max-width: 100%; height: 120px; display: block; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; touch-action: none; cursor: crosshair;"
        (pointerdown)="iniciar($event)"
        (pointermove)="mover($event)"
        (pointerup)="detener($event)"
        (pointercancel)="detener($event)"
      ></canvas>
      <div style="margin-top: 8px; display: flex; gap: 8px;">
        <button type="button" (click)="limpiar()">Limpiar</button>
        <button type="button" (click)="confirmar()">Usar firma</button>
      </div>
    </div>
  `,
})
export class FirmaCanvasComponent implements AfterViewInit {
  @ViewChild('canvasEl') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Output() firmaLista = new EventEmitter<string | null>();

  private ctx: CanvasRenderingContext2D | null = null;
  private dibujando = false;
  private tieneTrazo = false;
  private dpr = 1;

  ngAfterViewInit(): void {
    this.configurarCanvas();
  }

  private configurarCanvas(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    this.dpr = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width > 0 ? rect.width : 340;
    const cssHeight = rect.height > 0 ? rect.height : 120;

    canvas.width = Math.round(cssWidth * this.dpr);
    canvas.height = Math.round(cssHeight * this.dpr);

    const context = canvas.getContext('2d');
    if (!context) return;

    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    context.strokeStyle = '#0f294a';
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    this.ctx = context;
  }

  private coords(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  iniciar(e: PointerEvent): void {
    if (!this.ctx) {
      this.configurarCanvas();
    }
    if (!this.ctx) return;

    const canvas = this.canvasRef.nativeElement;
    if (canvas.hasPointerCapture?.(e.pointerId) === false) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Ignorar si el navegador no soporta captura en este puntero
      }
    }

    const p = this.coords(e);
    this.dibujando = true;
    this.ctx.beginPath();
    this.ctx.moveTo(p.x, p.y);
  }

  mover(e: PointerEvent): void {
    if (!this.dibujando || !this.ctx) return;
    const p = this.coords(e);
    this.ctx.lineTo(p.x, p.y);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(p.x, p.y);
    this.tieneTrazo = true;
  }

  detener(e: PointerEvent): void {
    if (!this.dibujando) return;
    this.dibujando = false;
    this.ctx?.beginPath();

    const canvas = this.canvasRef?.nativeElement;
    if (canvas?.hasPointerCapture?.(e.pointerId)) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Ignorar
      }
    }
  }

  limpiar(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.ctx) return;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.ctx.restore();
    this.tieneTrazo = false;
    this.firmaLista.emit(null);
  }

  confirmar(): void {
    if (!this.tieneTrazo) {
      this.firmaLista.emit(null);
      return;
    }
    const base64 = this.canvasRef.nativeElement.toDataURL('image/png');
    this.firmaLista.emit(base64);
  }
}