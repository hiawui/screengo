// selector.ts - Area selector (drag selection box)

import type { SelectedArea } from '../types';

export class AreaSelector {
  private readonly BORDER_SIZE = 2;
  private isSelecting: boolean = false;
  private isResizing: boolean = false;
  private isMoving: boolean = false;
  private resizeDirection: string = '';
  private resizeStartX: number = 0;
  private resizeStartY: number = 0;
  private moveStartX: number = 0;
  private moveStartY: number = 0;
  private resizeStartRect: { left: number, top: number, width: number, height: number } = { left: 0, top: 0, width: 0, height: 0 };
  private moveStartRect: { left: number, top: number, width: number, height: number } = { left: 0, top: 0, width: 0, height: 0 };
  private startX: number = 0;
  private startY: number = 0;
  private currentX: number = 0;
  private currentY: number = 0;
  private overlay: HTMLDivElement | null = null;
  private selectionBox: HTMLDivElement | null = null;
  private callback: ((area: SelectedArea | null) => void) | null = null;

  startSelection(callback: (area: SelectedArea | null) => void): void {
    // If already selecting, cleanup first
    if (this.isSelecting) {
      this.cleanup();
    }
    
    // Remove existing overlay and selection box if any
    this.removeOverlay();
    this.removeSelectionBox();
    
    this.callback = callback;
    this.isSelecting = true;
    
    // Create overlay only (selectionBox will be created on mousedown)
    this.createOverlay();
    
    // Reset overlay mask (no selection yet)
    if (this.overlay) {
      this.overlay.style.maskImage = 'none';
      this.overlay.style.webkitMaskImage = 'none';
    }
    
    // Bind events
    document.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private createOverlay(): void {
    // Create overlay only (selectionBox will be created on mousedown)
    this.overlay = document.createElement('div');
    this.overlay.id = 'screengo-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.3);
      z-index: 999996;
      cursor: crosshair;
      user-select: none;
    `;

    document.body.appendChild(this.overlay);
  }

  private createSelectionBox(): void {
    // Create selection box on mousedown
    if (this.selectionBox) {
      return; // Already exists
    }

    this.selectionBox = document.createElement('div');
    this.selectionBox.id = 'screengo-selection-box';
    this.selectionBox.style.cssText = `
      box-sizing: content-box;
      position: fixed;
      border: ${this.BORDER_SIZE}px dashed #4CAF50;
      background: transparent;
      pointer-events: none;
      z-index: 999999;
      display: block;
      cursor: move;
    `;
    
    // Add resize handles (corners only) and borders (edges)
    // Also make the box itself interactive for moving (pointer-events: auto)
    // But we only want to enable pointer events after selection is finished
    // During selection, we want pointer events to pass through so we can drag to draw
    // We'll update pointer-events in finishSelection
    this.selectionBox.innerHTML = `
      <div class="screengo-border screengo-border-n"></div>
      <div class="screengo-border screengo-border-e"></div>
      <div class="screengo-border screengo-border-s"></div>
      <div class="screengo-border screengo-border-w"></div>
      <div class="screengo-handle screengo-handle-nw"></div>
      <div class="screengo-handle screengo-handle-ne"></div>
      <div class="screengo-handle screengo-handle-se"></div>
      <div class="screengo-handle screengo-handle-sw"></div>
    `;

    document.body.appendChild(this.selectionBox);
  }


  private handleResizeStart(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    
    this.isResizing = true;
    const target = e.target as HTMLElement;
    
    // Determine direction from class name
    if (target.classList.contains('screengo-handle-nw')) this.resizeDirection = 'nw';
    else if (target.classList.contains('screengo-border-n')) this.resizeDirection = 'n';
    else if (target.classList.contains('screengo-handle-ne')) this.resizeDirection = 'ne';
    else if (target.classList.contains('screengo-border-e')) this.resizeDirection = 'e';
    else if (target.classList.contains('screengo-handle-se')) this.resizeDirection = 'se';
    else if (target.classList.contains('screengo-border-s')) this.resizeDirection = 's';
    else if (target.classList.contains('screengo-handle-sw')) this.resizeDirection = 'sw';
    else if (target.classList.contains('screengo-border-w')) this.resizeDirection = 'w';
    
    this.resizeStartX = e.clientX;
    this.resizeStartY = e.clientY;
    
    // Capture current box state
    const rect = this.selectionBox!.getBoundingClientRect();
    this.resizeStartRect = {
      left: rect.left,
      top: rect.top,
      width: rect.width - (this.BORDER_SIZE * 2),
      height: rect.height - (this.BORDER_SIZE * 2)
    };
    
    document.addEventListener('mousemove', this.handleResizeMove);
    document.addEventListener('mouseup', this.handleResizeEnd);
  }

  private handleResizeMove = (e: MouseEvent): void => {
    if (!this.isResizing || !this.selectionBox) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const dx = e.clientX - this.resizeStartX;
    const dy = e.clientY - this.resizeStartY;
    
    let newLeft = this.resizeStartRect.left;
    let newTop = this.resizeStartRect.top;
    let newWidth = this.resizeStartRect.width;
    let newHeight = this.resizeStartRect.height;
    
    if (this.resizeDirection.includes('n')) {
      newTop += dy;
      newHeight -= dy;
    }
    if (this.resizeDirection.includes('s')) {
      newHeight += dy;
    }
    if (this.resizeDirection.includes('w')) {
      newLeft += dx;
      newWidth -= dx;
    }
    if (this.resizeDirection.includes('e')) {
      newWidth += dx;
    }
    
    // Enforce minimum size
    if (newWidth < 10) {
      if (this.resizeDirection.includes('w')) newLeft = this.resizeStartRect.left + this.resizeStartRect.width - 10;
      newWidth = 10;
    }
    if (newHeight < 10) {
      if (this.resizeDirection.includes('n')) newTop = this.resizeStartRect.top + this.resizeStartRect.height - 10;
      newHeight = 10;
    }
    
    // Update selection box style
    this.selectionBox.style.left = newLeft + 'px';
    this.selectionBox.style.top = newTop + 'px';
    this.selectionBox.style.width = newWidth + 'px';
    this.selectionBox.style.height = newHeight + 'px';
    
    // Update internal state so getSelectedArea works correctly
    this.startX = newLeft;
    this.startY = newTop;
    this.currentX = newLeft + newWidth;
    this.currentY = newTop + newHeight;
    
    // Update overlay mask
    // With content-box (default), width/height refers to content area, so we only need to offset position for border
    const maskLeft = newLeft + this.BORDER_SIZE;
    const maskTop = newTop + this.BORDER_SIZE;
    const maskWidth = Math.max(0, newWidth);
    const maskHeight = Math.max(0, newHeight);
    
    this.updateOverlayMask(maskLeft, maskTop, maskWidth, maskHeight);
  };

  private handleMoveStart(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    
    this.isMoving = true;
    this.moveStartX = e.clientX;
    this.moveStartY = e.clientY;
    
    // Capture current box state
    const rect = this.selectionBox!.getBoundingClientRect();
    this.moveStartRect = {
      left: rect.left,
      top: rect.top,
      width: rect.width - (this.BORDER_SIZE * 2),
      height: rect.height - (this.BORDER_SIZE * 2)
    };
    
    document.addEventListener('mousemove', this.handleMove);
    document.addEventListener('mouseup', this.handleMoveEnd);
  }

  private handleMove = (e: MouseEvent): void => {
    if (!this.isMoving || !this.selectionBox) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const dx = e.clientX - this.moveStartX;
    const dy = e.clientY - this.moveStartY;
    
    let newLeft = this.moveStartRect.left + dx;
    let newTop = this.moveStartRect.top + dy;
    
    // Constrain to window bounds
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const width = this.moveStartRect.width;
    const height = this.moveStartRect.height;
    
    // Optional: Allow moving partially off-screen or constrain strictly?
    // Let's constrain strictly for now
    newLeft = Math.max(0, Math.min(newLeft, windowWidth - width));
    newTop = Math.max(0, Math.min(newTop, windowHeight - height));
    
    // Update selection box style
    this.selectionBox.style.left = newLeft + 'px';
    this.selectionBox.style.top = newTop + 'px';
    
    // Update internal state
    this.startX = newLeft;
    this.startY = newTop;
    this.currentX = newLeft + width;
    this.currentY = newTop + height;
    
    // Update overlay mask
    const maskLeft = newLeft + this.BORDER_SIZE;
    const maskTop = newTop + this.BORDER_SIZE;
    const maskWidth = Math.max(0, width);
    const maskHeight = Math.max(0, height);
    
    this.updateOverlayMask(maskLeft, maskTop, maskWidth, maskHeight);
  };

  private handleMoveEnd = (_e: MouseEvent): void => {
    if (!this.isMoving) return;
    
    this.isMoving = false;
    document.removeEventListener('mousemove', this.handleMove);
    document.removeEventListener('mouseup', this.handleMoveEnd);
    
    // Callback with new area
    const area = this.getSelectedArea();
    if (this.callback) {
      this.callback(area);
    }
  };

  private handleResizeEnd = (_e: MouseEvent): void => {
    if (!this.isResizing) return;
    
    this.isResizing = false;
    document.removeEventListener('mousemove', this.handleResizeMove);
    document.removeEventListener('mouseup', this.handleResizeEnd);
    
    // Callback with new area
    const area = this.getSelectedArea();
    if (this.callback) {
      this.callback(area);
    }
  };

  private handleMouseDown = (e: MouseEvent): void => {
    // Check if resizing or moving
    if (this.selectionBox) {
      const target = e.target as HTMLElement;
      if (target.classList.contains('screengo-handle') || target.classList.contains('screengo-border')) {
        this.handleResizeStart(e);
        return;
      }
      
      // Check if clicking on the box itself (for moving)
      // This will only happen if pointer-events is set to auto (after selection finished)
      if (target === this.selectionBox || target.id === 'screengo-selection-box') {
        this.handleMoveStart(e);
        return;
      }
    }

    if (!this.isSelecting) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.currentX = e.clientX;
    this.currentY = e.clientY;
    
    // Create selection box on mousedown
    this.createSelectionBox();
    this.updateSelectionBox();
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.isSelecting || !this.selectionBox) return;
    
    this.currentX = e.clientX;
    this.currentY = e.clientY;
    this.updateSelectionBox();
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (!this.isSelecting) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const area = this.getSelectedArea();
    console.log(`handleMouseUp area: ${area.width}, ${area.height}`);
    if (area.width > 10 && area.height > 10) {
      // Only confirm if selection area is large enough
      this.finishSelection(area);
    } else {
      // Area too small, cancel selection
      this.cancelSelection();
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (this.selectionBox) {
        // If selection box exists, reset to initial state (ready to draw)
        // We can reuse startSelection to reset everything, passing the same callback
        this.startSelection(this.callback!);
      } else {
        // If no selection box, cancel the entire selection process
        this.cancelSelection();
      }
    }
  };

  private updateSelectionBox(): void {
    if (!this.selectionBox) return;
    
    const left = Math.min(this.startX, this.currentX);
    const top = Math.min(this.startY, this.currentY);
    const width = Math.abs(this.currentX - this.startX);
    const height = Math.abs(this.currentY - this.startY);
    
    this.selectionBox.style.left = left + 'px';
    this.selectionBox.style.top = top + 'px';
    this.selectionBox.style.width = width + 'px';
    this.selectionBox.style.height = height + 'px';
    
    // Update overlay mask to exclude selection area
    // Also adjust for selection box border to match the actual recording area
    // With content-box (default), width/height refers to content area, so we only need to offset position
    const maskLeft = left + this.BORDER_SIZE;
    const maskTop = top + this.BORDER_SIZE;
    const maskWidth = Math.max(0, width);
    const maskHeight = Math.max(0, height);
    
    this.updateOverlayMask(maskLeft, maskTop, maskWidth, maskHeight);
  }

  private updateOverlayMask(left: number, top: number, width: number, height: number): void {
    if (!this.overlay) return;
    
    if (width === 0 || height === 0) {
      // If no selection, overlay covers entire screen (no mask)
      this.overlay.style.maskImage = 'none';
      this.overlay.style.webkitMaskImage = 'none';
      return;
    }
    
    // Use CSS mask to create a frame effect (simpler than polygon)
    // Note: inset() can't directly exclude a region, so we use CSS mask instead
    // The mask creates a transparent rectangle in the middle (the selection area)
    const maskImage = `linear-gradient(to bottom, 
      black 0, 
      black ${top}px, 
      transparent ${top}px, 
      transparent ${top + height}px, 
      black ${top + height}px, 
      black 100%
    )`;
    
    const maskImage2 = `linear-gradient(to right, 
      black 0, 
      black ${left}px, 
      transparent ${left}px, 
      transparent ${left + width}px, 
      black ${left + width}px, 
      black 100%
    )`;
    
    // Combine both masks using intersect to create the frame
    this.overlay.style.maskImage = `${maskImage}, ${maskImage2}`;
    this.overlay.style.maskComposite = 'intersect';
    this.overlay.style.webkitMaskImage = `${maskImage}, ${maskImage2}`;
    this.overlay.style.webkitMaskComposite = 'source-over';
  }

  private getSelectedArea(): SelectedArea {
    const left = Math.min(this.startX, this.currentX);
    const top = Math.min(this.startY, this.currentY);
    const width = Math.abs(this.currentX - this.startX);
    const height = Math.abs(this.currentY - this.startY);
    
    // Adjust for selection box border to exclude it from the selected area
    // This ensures we only capture the inner content
    // With content-box (default), width/height refers to content area, so we only need to offset position
    
    return {
      x: left + this.BORDER_SIZE,
      y: top + this.BORDER_SIZE,
      width: Math.max(0, width),
      height: Math.max(0, height)
    };
  }

  private finishSelection(area: SelectedArea): void {
    console.log(`finishSelection. area: ${area.width}, ${area.height}, callback: ${this.callback}`);
    // Save callback before cleanup
    const callback = this.callback;
    
    this.isSelecting = false;
    
    // Remove mouse event listeners (selection is complete)
    // Note: we keep mousedown for resize handles
    // document.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    
    // Update overlay mask to maintain transparent selection area
    this.updateOverlayMask(area.x, area.y, area.width, area.height);
    
    // Make overlay non-interactive so user can interact with the webpage
    // BUT keeps handles interactive because they are children of selectionBox which is above overlay
    if (this.overlay) {
      this.overlay.style.pointerEvents = 'none';
      this.overlay.style.cursor = 'default';
    }
    
    // Enable pointer events on selection box to allow moving/resizing
    if (this.selectionBox) {
      this.selectionBox.style.pointerEvents = 'auto';
    }
    
    if (callback) {
      console.log('Calling callback with area:', area);
      callback(area);
    } else {
      console.warn('Callback is null, cannot execute');
    }
  }

  private cancelSelection(): void {
    console.log(`cancelSelection`);
    // Save callback before cleanup (cleanup sets callback to null)
    const callback = this.callback;
    this.cleanup();
    if (callback) {
      console.log('Calling callback with null (cancelled)');
      callback(null);
    } else {
      console.warn('Callback is null, cannot execute');
    }
  }

  removeOverlay(): void {
    // Remove overlay (called when recording ends or new selection starts)
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  removeSelectionBox(): void {
    // Remove selection box (called when recording ends or new selection starts)
    if (this.selectionBox) {
      this.selectionBox.remove();
      this.selectionBox = null;
    }
  }

  cleanup(): void {
    // Full cleanup - remove everything including overlay and selectionBox
    this.isSelecting = false;
    
    // Remove all event listeners
    document.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('keydown', this.handleKeyDown);
    
    // Remove overlay and selectionBox
    this.removeOverlay();
    this.removeSelectionBox();
    
    // Clear callback
    this.callback = null;
  }

  lock(): void {
    if (!this.selectionBox) return;
    
    // Disable interaction on the box
    this.selectionBox.style.pointerEvents = 'none';
    this.selectionBox.style.cursor = 'default';
    
    // Hide handles and borders to give a clean look during recording
    const children = this.selectionBox.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement;
      child.style.display = 'none';
    }
    
    // Remove event listeners to prevent any interaction
    document.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('keydown', this.handleKeyDown);
    
    // Reset interaction states
    this.isSelecting = false;
    this.isResizing = false;
    this.isMoving = false;
  }
}

