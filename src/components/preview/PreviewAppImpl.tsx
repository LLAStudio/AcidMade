export function PreviewApp({ device, selectedNodeId, hiddenNodeIds, agentOverlay }: {
  device: "desktop" | "mobile";
  selectedNodeId: string;
  hiddenNodeIds: string[];
  agentOverlay: boolean;
}) {
  return (
    <div className="preview-root" data-device={device} data-selected={selectedNodeId} data-hidden={hiddenNodeIds.join(",")} data-agent-overlay={String(agentOverlay)}>
      <div className="preview-shell">
        <header className="preview-bar">AcidMade preview</header>
        <main className="preview-stage">
          <div className="preview-scene">
            Scene preview for {selectedNodeId}
            {hiddenNodeIds.length ? ` · hidden: ${hiddenNodeIds.length}` : ""}
          </div>
          {agentOverlay ? <div className="preview-agent-overlay">live agent overlay</div> : null}
        </main>
      </div>
    </div>
  );
}
