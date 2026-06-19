// Simulator Visualizer Engine for Avalanche L1 Teleporter
export class TeleporterSimulator {
  constructor(svgId, containerId) {
    this.svg = document.getElementById(svgId);
    this.container = document.getElementById(containerId);
    
    this.chains = [];
    this.sourceChainId = null;
    this.destChainId = null;
    this.validatorCount = 12;
    
    this.animationFrameId = null;
    this.animState = 'idle'; // 'idle', 'dispatching', 'signing', 'relaying', 'executing'
    this.animProgress = 0;
    this.activeStep = -1;
    
    // Callback functions for UI status updates
    this.onStepChange = null;
    this.onSimulationComplete = null;
    this.onBurnUpdate = null;
    
    // Internal coordinate systems
    this.width = 800;
    this.height = 500;
    
    // Anchor positions
    this.centerHub = { x: 400, y: 250 };
    this.relayerPos = { x: 400, y: 390 };
    this.validatorRingCenter = { x: 400, y: 130 };
    this.validatorRingRadius = 65;
  }

  setChains(chains) {
    this.chains = chains;
    this.render();
  }

  setSourceAndDest(sourceId, destId) {
    this.sourceChainId = sourceId;
    this.destChainId = destId;
    this.render();
  }

  setValidators(count) {
    this.validatorCount = parseInt(count);
    this.render();
  }

  // Calculate coordinates for nodes based on their indexes
  getNodePosition(id, index, total) {
    // We arrange source subnets on the left and destination on the right
    const isSource = id === this.sourceChainId;
    const isDest = id === this.destChainId;
    
    if (isSource) {
      return { x: 120, y: 250 };
    }
    if (isDest) {
      return { x: 680, y: 250 };
    }
    
    // Others are distributed at the top-left / bottom-left
    const offset = index % 2 === 0 ? 1 : -1;
    return {
      x: 100 + (index * 15),
      y: 250 + offset * 110
    };
  }

  render() {
    this.clearSVG();
    
    // Draw background grid pattern
    this.drawBackgroundGrid();

    // 1. Draw Connection Paths
    const sourceNode = this.chains.find(c => c.id === this.sourceChainId);
    const destNode = this.chains.find(c => c.id === this.destChainId);
    
    if (sourceNode && destNode) {
      const pSrc = this.getNodePosition(sourceNode.id, 0, 1);
      const pDst = this.getNodePosition(destNode.id, 1, 1);
      
      // Draw connection curves through center/relayer
      this.drawCurve(pSrc, this.centerHub, 'active-path', 'path-src-hub');
      this.drawCurve(this.centerHub, this.relayerPos, 'active-path', 'path-hub-relay');
      this.drawCurve(this.relayerPos, pDst, 'active-path', 'path-relay-dst');
    }

    // 2. Draw Relayer Node
    this.drawRelayer();

    // 3. Draw Validator Ring and Nodes
    this.drawValidators();

    // 4. Draw Subnet Chains
    this.chains.forEach((chain, index) => {
      const pos = this.getNodePosition(chain.id, index, this.chains.length);
      const isActive = chain.id === this.sourceChainId || chain.id === this.destChainId;
      const role = chain.id === this.sourceChainId ? 'SRC' : (chain.id === this.destChainId ? 'DST' : 'INACTIVE');
      
      this.drawChainNode(chain, pos, isActive, role);
    });
  }

  clearSVG() {
    // Keep defs but clear elements
    const defs = this.svg.querySelector('defs');
    this.svg.innerHTML = '';
    if (defs) {
      this.svg.appendChild(defs);
    }
    
    // Add layers back
    const layers = ['connections-group', 'validators-group', 'chains-group', 'packets-group'];
    layers.forEach(id => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('id', id);
      this.svg.appendChild(g);
    });
  }

  drawBackgroundGrid() {
    const connGroup = this.svg.getElementById('connections-group');
    
    // Subtle crosshairs/grid
    for (let x = 50; x < this.width; x += 50) {
      for (let y = 50; y < this.height; y += 50) {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', x);
        dot.setAttribute('cy', y);
        dot.setAttribute('r', 1);
        dot.setAttribute('fill', 'rgba(255,255,255,0.025)');
        connGroup.appendChild(dot);
      }
    }
  }

  drawChainNode(chain, pos, isActive, role) {
    const chainsGroup = this.svg.getElementById('chains-group');
    
    // Outer glow if active
    if (isActive) {
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      glow.setAttribute('cx', pos.x);
      glow.setAttribute('cy', pos.y);
      glow.setAttribute('r', 45);
      glow.setAttribute('fill', 'url(#glowGrad)');
      glow.setAttribute('opacity', '0.6');
      chainsGroup.appendChild(glow);
    }

    // Main Circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', pos.x);
    circle.setAttribute('cy', pos.y);
    circle.setAttribute('r', 35);
    circle.setAttribute('class', `node-circle ${isActive ? 'active-node' : ''}`);
    if (isActive) {
      circle.setAttribute('stroke', role === 'SRC' ? 'url(#primaryGrad)' : 'url(#tealGrad)');
    }
    chainsGroup.appendChild(circle);

    // Text Label
    const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    nameText.setAttribute('x', pos.x);
    nameText.setAttribute('y', pos.y - 2);
    nameText.setAttribute('class', 'node-text');
    nameText.textContent = chain.name;
    chainsGroup.appendChild(nameText);

    // Subtext (Token Symbol)
    const tokenText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    tokenText.setAttribute('x', pos.x);
    tokenText.setAttribute('y', pos.y + 14);
    tokenText.setAttribute('class', 'node-subtext');
    tokenText.textContent = chain.token;
    chainsGroup.appendChild(tokenText);

    // Role Indicator Badge
    if (role !== 'INACTIVE') {
      const badge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      badge.setAttribute('x', pos.x);
      badge.setAttribute('y', pos.y - 45);
      badge.setAttribute('font-size', '9px');
      badge.setAttribute('font-weight', '800');
      badge.setAttribute('letter-spacing', '0.05em');
      badge.setAttribute('text-anchor', 'middle');
      badge.setAttribute('fill', role === 'SRC' ? '#ff6b6b' : '#00f2fe');
      badge.textContent = role === 'SRC' ? 'SOURCE L1' : 'DEST L1';
      chainsGroup.appendChild(badge);
    }
  }

  drawValidators() {
    const valGroup = this.svg.getElementById('validators-group');
    
    // Draw Validator Circle
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ring.setAttribute('cx', this.validatorRingCenter.x);
    ring.setAttribute('cy', this.validatorRingCenter.y);
    ring.setAttribute('r', this.validatorRingRadius);
    ring.setAttribute('class', 'validator-ring');
    valGroup.appendChild(ring);

    // AWM Hub Node in center of validators
    const hub = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hub.setAttribute('cx', this.centerHub.x);
    hub.setAttribute('cy', this.centerHub.y);
    hub.setAttribute('r', 18);
    hub.setAttribute('fill', '#12121a');
    hub.setAttribute('stroke', 'rgba(143, 0, 255, 0.4)');
    hub.setAttribute('stroke-width', '2');
    valGroup.appendChild(hub);

    const hubLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    hubLabel.setAttribute('x', this.centerHub.x);
    hubLabel.setAttribute('y', this.centerHub.y + 4);
    hubLabel.setAttribute('font-size', '8px');
    hubLabel.setAttribute('font-weight', '700');
    hubLabel.setAttribute('fill', '#d162ff');
    hubLabel.setAttribute('text-anchor', 'middle');
    hubLabel.textContent = 'AWM';
    valGroup.appendChild(hubLabel);

    // Render individual Validator Nodes
    for (let i = 0; i < this.validatorCount; i++) {
      const angle = (i * 2 * Math.PI) / this.validatorCount;
      const x = this.validatorRingCenter.x + this.validatorRingRadius * Math.cos(angle);
      const y = this.validatorRingCenter.y + this.validatorRingRadius * Math.sin(angle);
      
      const valDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      valDot.setAttribute('cx', x);
      valDot.setAttribute('cy', y);
      valDot.setAttribute('r', 5);
      valDot.setAttribute('id', `validator-node-${i}`);
      valDot.setAttribute('class', 'validator-dot');
      valGroup.appendChild(valDot);
    }
  }

  drawRelayer() {
    const chainsGroup = this.svg.getElementById('chains-group');
    
    // Relayer base circle
    const rel = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    rel.setAttribute('cx', this.relayerPos.x);
    rel.setAttribute('cy', this.relayerPos.y);
    rel.setAttribute('r', 20);
    rel.setAttribute('fill', '#12121a');
    rel.setAttribute('stroke', '#00f2fe');
    rel.setAttribute('stroke-width', '1.5');
    chainsGroup.appendChild(rel);

    // Relayer label
    const relLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    relLabel.setAttribute('x', this.relayerPos.x);
    relLabel.setAttribute('y', this.relayerPos.y + 4);
    relLabel.setAttribute('font-size', '8px');
    relLabel.setAttribute('font-weight', '700');
    relLabel.setAttribute('fill', '#00f2fe');
    relLabel.setAttribute('text-anchor', 'middle');
    relLabel.textContent = 'RELAYER';
    chainsGroup.appendChild(relLabel);
  }

  drawCurve(start, end, className, id) {
    const connGroup = this.svg.getElementById('connections-group');
    
    // Draw Bezier curves for organic, professional flow lines
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    let pathString = '';
    
    if (className === 'active-path') {
      // Create curved lines
      const ctrlX = start.x + dx * 0.5;
      const ctrlY = start.y + dy * 0.1; // subtle curve
      pathString = `M ${start.x} ${start.y} Q ${ctrlX} ${ctrlY} ${end.x} ${end.y}`;
    } else {
      pathString = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathString);
    path.setAttribute('class', className);
    if (id) path.setAttribute('id', id);
    connGroup.appendChild(path);
  }

  // Animation Sequence Loops
  startSimulation() {
    if (this.animState !== 'idle') return;
    this.animState = 'dispatching';
    this.animProgress = 0;
    this.updateStep(0);
    
    // Play sound or log if needed, let's start requestAnimationFrame loop
    this.animate();
  }

  resetSimulation() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animState = 'idle';
    this.animProgress = 0;
    this.updateStep(-1);
    
    // Remove temporary packets
    const pGroup = this.svg.getElementById('packets-group');
    if (pGroup) pGroup.innerHTML = '';
    
    // Reset validator states
    for (let i = 0; i < this.validatorCount; i++) {
      const dot = document.getElementById(`validator-node-${i}`);
      if (dot) dot.setAttribute('class', 'validator-dot');
    }
    
    this.render();
  }

  updateStep(stepIndex) {
    this.activeStep = stepIndex;
    if (this.onStepChange) {
      this.onStepChange(stepIndex);
    }
    
    // Apply styling to indicators
    for (let i = 0; i < 4; i++) {
      const el = document.getElementById(`step-${i}`);
      if (!el) continue;
      el.classList.remove('active', 'completed');
      if (i < stepIndex) {
        el.classList.add('completed');
      } else if (i === stepIndex) {
        el.classList.add('active');
      }
    }
  }

  animate() {
    const pGroup = this.svg.getElementById('packets-group');
    const sourceNode = this.chains.find(c => c.id === this.sourceChainId);
    const destNode = this.chains.find(c => c.id === this.destChainId);
    
    if (!sourceNode || !destNode) return;
    
    const pSrc = this.getNodePosition(sourceNode.id, 0, 1);
    const pDst = this.getNodePosition(destNode.id, 1, 1);

    // Frame update logic
    if (this.animState === 'dispatching') {
      this.animProgress += 0.015; // speed
      
      // Draw message packet moving from Source L1 to AWM Hub
      pGroup.innerHTML = '';
      const packet = this.getPositionAlongCurve('path-src-hub', this.animProgress);
      this.drawPacket(packet.x, packet.y);
      
      if (this.animProgress >= 1) {
        this.animState = 'signing';
        this.animProgress = 0;
        this.updateStep(1);
      }
    } 
    
    else if (this.animState === 'signing') {
      this.animProgress += 0.012;
      
      // Animate line flashes from AWM hub to validator set
      pGroup.innerHTML = '';
      this.drawPacket(this.centerHub.x, this.centerHub.y);
      
      // Animate validators progressively signing
      const signedCount = Math.min(
        this.validatorCount,
        Math.floor(this.animProgress * this.validatorCount * 1.2) // speed-up slightly
      );
      
      for (let i = 0; i < this.validatorCount; i++) {
        const dot = document.getElementById(`validator-node-${i}`);
        if (!dot) continue;
        
        if (i < signedCount) {
          dot.setAttribute('class', 'validator-dot signed');
          
          // Draw faint laser connection from AWM center to signed node
          const targetX = parseFloat(dot.getAttribute('cx'));
          const targetY = parseFloat(dot.getAttribute('cy'));
          
          const laser = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          laser.setAttribute('x1', this.centerHub.x);
          laser.setAttribute('y1', this.centerHub.y);
          laser.setAttribute('x2', targetX);
          laser.setAttribute('y2', targetY);
          laser.setAttribute('stroke', 'rgba(0, 230, 118, 0.4)');
          laser.setAttribute('stroke-width', '1.5');
          pGroup.appendChild(laser);
        }
      }
      
      if (this.animProgress >= 1) {
        this.animState = 'relaying';
        this.animProgress = 0;
        this.updateStep(2);
      }
    } 
    
    else if (this.animState === 'relaying') {
      this.animProgress += 0.012;
      pGroup.innerHTML = '';
      
      if (this.animProgress < 0.4) {
        // Move from AWM Center Hub down to Relayer
        const segmentProgress = this.animProgress / 0.4;
        const packet = this.getPositionAlongCurve('path-hub-relay', segmentProgress);
        this.drawPacket(packet.x, packet.y);
      } else {
        // Move from Relayer to Destination Subnet
        const segmentProgress = (this.animProgress - 0.4) / 0.6;
        const packet = this.getPositionAlongCurve('path-relay-dst', segmentProgress);
        this.drawPacket(packet.x, packet.y);
      }
      
      if (this.animProgress >= 1) {
        this.animState = 'executing';
        this.animProgress = 0;
        this.updateStep(3);
      }
    } 
    
    else if (this.animState === 'executing') {
      this.animProgress += 0.02;
      pGroup.innerHTML = '';
      
      // Pulse the destination node and spawn particles on arrival
      const destNodeEl = this.svg.getElementById('chains-group').lastChild; // select last circle
      const scaleVal = 1 + Math.sin(this.animProgress * Math.PI) * 0.12;
      
      // Particle explosion
      const pCount = 8;
      for (let i = 0; i < pCount; i++) {
        const angle = (i * 2 * Math.PI) / pCount;
        const dist = this.animProgress * 60;
        const px = pDst.x + dist * Math.cos(angle);
        const py = pDst.y + dist * Math.sin(angle);
        
        const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        particle.setAttribute('cx', px);
        particle.setAttribute('cy', py);
        particle.setAttribute('r', 3 * (1 - this.animProgress));
        particle.setAttribute('fill', '#00f2fe');
        particle.setAttribute('opacity', 1 - this.animProgress);
        pGroup.appendChild(particle);
      }
      
      if (this.animProgress >= 1) {
        this.animState = 'completed';
        this.updateStep(4);
        
        if (this.onSimulationComplete) {
          this.onSimulationComplete();
        }
        if (this.onBurnUpdate) {
          // Increment simulated burn statistics
          this.onBurnUpdate();
        }
        return; // stop loop
      }
    }

    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  drawPacket(cx, cy) {
    const pGroup = this.svg.getElementById('packets-group');
    const packet = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    packet.setAttribute('cx', cx);
    packet.setAttribute('cy', cy);
    packet.setAttribute('r', 6);
    packet.setAttribute('class', 'packet-circle');
    pGroup.appendChild(packet);
  }

  // Returns point coordinate along a drawn SVG curve
  getPositionAlongCurve(pathId, progress) {
    const path = this.svg.getElementById(pathId);
    if (!path) return { x: 0, y: 0 };
    
    try {
      const len = path.getTotalLength();
      const pt = path.getPointAtLength(progress * len);
      return { x: pt.x, y: pt.y };
    } catch(e) {
      // Fallback in environments that do not fully implement getPointAtLength
      return { x: 400, y: 250 };
    }
  }
}
