'use client';

import { useState } from 'react';
import type { RightPanelTab } from '@/features/development/components/panel-rails';

export function useDevelopmentLayoutState() {
  const [previewHeight, setPreviewHeight] = useState(36);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('config');
  const [settingsCollapsed, setSettingsCollapsed] = useState(false);
  const [settingsWidth, setSettingsWidth] = useState(560);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(300);

  function startHorizontalResize(
    event: React.MouseEvent,
    currentWidth: number,
    onResize: (width: number) => void,
    options: { direction?: 'left' | 'right'; max: number; min: number },
  ) {
    event.preventDefault();
    const startX = event.clientX;
    const direction = options.direction ?? 'right';
    const handleMove = (moveEvent: MouseEvent) => {
      const delta = direction === 'right' ? moveEvent.clientX - startX : startX - moveEvent.clientX;
      onResize(Math.min(options.max, Math.max(options.min, currentWidth + delta)));
    };
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }

  function startVerticalResize(event: React.MouseEvent) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = previewHeight;
    const handleMove = (moveEvent: MouseEvent) => {
      setPreviewHeight(Math.min(420, Math.max(36, startHeight + startY - moveEvent.clientY)));
    };
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }

  function toggleSettingsPanel() {
    setSettingsCollapsed((prev) => !prev);
  }

  function toggleSidebar() {
    setSidebarCollapsed((prev) => !prev);
  }

  return {
    previewHeight,
    rightPanelTab,
    settingsCollapsed,
    settingsWidth,
    setPreviewHeight,
    setRightPanelTab,
    setSettingsWidth,
    setSidebarCollapsed,
    setSidebarWidth,
    sidebarCollapsed,
    sidebarWidth,
    startHorizontalResize,
    startVerticalResize,
    toggleSettingsPanel,
    toggleSidebar,
  };
}
