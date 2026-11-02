window.__heat=[];window.__markers=[];window.__tiles=[];window.__ov=[];
(function(){
 class Layer{ addTo(m){ m._layers.add(this); this._map=m; return this;} remove(){ this._map?._layers.delete(this); return this;} bindPopup(p){this._pop=p;return this;} openPopup(){} on(){return this;} bringToBack(){return this;} bringToFront(){return this;} }
 class TileLayer extends Layer{ constructor(u,o){ super(); this.url=u; this.o=o; window.__tiles.push(u);} }
 class Group extends Layer{ constructor(){super(); this.items=[];} clearLayers(){this.items=[];} addLayer(l){this.items.push(l);} }
 const mkMap=el=>{ const m={_layers:new Set(),_h:{},setView(){return m;},invalidateSize(){},on(ev,fn){(m._h[ev]=m._h[ev]||[]).push(fn);return m;},fire(ev,a){(m._h[ev]||[]).forEach(f=>f(a));},
   removeLayer(l){m._layers.delete(l);},hasLayer(l){return m._layers.has(l);},eachLayer(fn){[...m._layers].forEach(fn);},fitBounds(){},closePopup(){document.querySelectorAll(".stub-popup").forEach(x=>x.remove());},
   getZoom(){return 14;},getCenter(){return {lat:44.2,lng:.6};},getBounds(){return {getSouth:()=>44.19,getNorth:()=>44.21,getWest:()=>.59,getEast:()=>.61};}}; window.__map=m; return m; };
 window.L={TileLayer,map:mkMap,tileLayer:(u,o)=>new TileLayer(u,o),layerGroup:()=>new Group(),
  marker:(ll,o)=>{ const m=new Layer(); m.ll=ll; m.o=o; window.__markers.push(ll); const add=m.addTo.bind(m); m.addTo=t=>{ if(t.items) t.addLayer(m); else add(t); return m;}; return m; },
  circleMarker:(ll)=>{ const m=new Layer(); const add=m.addTo.bind(m); m.addTo=t=>{ if(t.items) t.addLayer(m); else add(t); return m;}; return m;},
  polygon:(pts)=>{ const m=new Layer(); m.pts=pts; const add=m.addTo.bind(m); m.addTo=t=>{ if(t.items) t.addLayer(m); else add(t); return m;}; return m;},
  polyline:(pts)=>{ const m=new Layer(); m.pts=pts; const add=m.addTo.bind(m); m.addTo=t=>{ if(t.items) t.addLayer(m); else add(t); return m;}; return m;},
  imageOverlay:(u,b)=>{ const m=new Layer(); m.u=u; m.b=b; window.__ov.push(u); return m;},
  divIcon:o=>o, heatLayer:(pts)=>{ window.__heat=pts; return new Layer(); }, latLngBounds:()=>({pad(){return this;}}),
  popup:()=>{ const p={setLatLng(){return p;},setContent(c){p.c=c;return p;},openOn(){ const d=document.createElement("div"); d.className="stub-popup"; d.style.cssText="position:fixed;top:200px;left:20px;right:20px;background:#fff;color:#000;padding:10px;z-index:5000;border-radius:10px"; d.append(p.c); document.body.append(d); return p;}}; return p; }};
})();
