import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ScenarioKPIs,
  COLOR_FLOODZONE_FILL,
  COLOR_FLOODZONE_OUTLINE,
  COLOR_NTA_OUTLINE,
  COLOR_SELECTED_OUTLINE,
  SCENARIO_LABELS,
  SCENARIOS,
} from "./types";
import { fviExprForScenario, formatInt } from "./utils/mapHelpers";

interface FloodMapProps {
  kpiData: ScenarioKPIs;
  buildingsPmtilesUrl?: string;
  floodzonesPmtilesUrl?: string;
  ntaPmtilesUrl?: string;
  buildingsSourceLayer?: string;
  floodzonesSourceLayer?: string;
  ntaSourceLayer?: string;
  onSelectionChange?: (
    selectedIds: Set<string>,
    selectedNTA?: string,
    selectedBuilding?: { objectid: string; name?: string },
    selectedBorough?: string,
    customSelection?: { type: "custom"; bounds: any },
    selectionStats?: any,
    selectedZone?: string
  ) => void;
  initialScenario?: string;
  showBuildings?: boolean;
  showFloodzones?: boolean;
  showNTA?: boolean;
  lassoMode?: boolean;
  onLassoModeChange?: (enabled: boolean) => void;
}

export default function FloodMap({
  kpiData,
  buildingsPmtilesUrl = "pmtiles://dataprojects/dp1/buildings.pmtiles",
  floodzonesPmtilesUrl = "pmtiles://dataprojects/dp1/floodzones.pmtiles",
  ntaPmtilesUrl = "pmtiles://dataprojects/dp1/nta.pmtiles",
  buildingsSourceLayer = "buildings_wgs84_fvi",
  floodzonesSourceLayer = "floodzones_wgs84",
  ntaSourceLayer = "nta_wgs84",
  onSelectionChange,
  initialScenario = "ss_cur",
  showBuildings: initialShowBuildings = true,
  showFloodzones: initialShowFloodzones = true,
  showNTA: initialShowNTA = true,
  lassoMode: externalLassoMode = false,
  onLassoModeChange,
}: FloodMapProps) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const divRef = useRef<HTMLDivElement>(null);
  const [scenario, setScenario] = useState(initialScenario);
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<Set<string>>(new Set());
  const [selectedNTA, setSelectedNTA] = useState<string | null>(null);
  const [selectedNTAFeature, setSelectedNTAFeature] = useState<any>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<{ objectid: string; name?: string } | null>(null);
  const [selectedBorough, setSelectedBorough] = useState<string | null>(null);
  const [customSelection, setCustomSelection] = useState<{ type: "custom"; bounds: any } | null>(null);
  const [buildingFeaturesCache, setBuildingFeaturesCache] = useState<Map<string, any>>(new Map());
  const lassoModeRef = useRef(externalLassoMode);
  const selectedBuildingIdsRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    selectedBuildingIdsRef.current = selectedBuildingIds;
  }, [selectedBuildingIds]);

  useEffect(() => {
    lassoModeRef.current = externalLassoMode;
    const map = mapRef.current;
    if (map) {
      if (externalLassoMode) {
        map.getCanvas().style.cursor = "crosshair";
        map.boxZoom.disable();
        map.keyboard.disable();
      } else {
        map.getCanvas().style.cursor = "";
        map.boxZoom.enable();
        map.keyboard.enable();
      }
    }
    if (onLassoModeChange) {
      onLassoModeChange(externalLassoMode);
    }
  }, [externalLassoMode, onLassoModeChange]);
  const [showBuildings, setShowBuildings] = useState(initialShowBuildings);
  const [showFloodzones, setShowFloodzones] = useState(initialShowFloodzones);
  const [showNTA, setShowNTA] = useState(initialShowNTA);

  useEffect(() => {
    setShowBuildings(initialShowBuildings);
  }, [initialShowBuildings]);

  useEffect(() => {
    setShowFloodzones(initialShowFloodzones);
  }, [initialShowFloodzones]);

  useEffect(() => {
    setShowNTA(initialShowNTA);
  }, [initialShowNTA]);

  const isBoxSelectingRef = useRef(false);
  const boxStartRef = useRef<{ x: number; y: number } | null>(null);
  const boxElementRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;

    const protocol = new Protocol();
    (maplibregl as any).addProtocol("pmtiles", protocol.tile);

    console.log("🗺️ Initializing map with PMTiles sources:", {
      buildings: buildingsPmtilesUrl,
      floodzones: floodzonesPmtilesUrl,
      nta: ntaPmtilesUrl,
    });

    const style = {
      version: 8,
      sources: {
        basemap: {
          type: "raster",
          tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
        },
        buildings: {
          type: "vector",
          url: buildingsPmtilesUrl,
          promoteId: "objectid",
        },
        floodzones: {
          type: "vector",
          url: floodzonesPmtilesUrl,
        },
        nta: {
          type: "vector",
          url: ntaPmtilesUrl,
        },
      },
      layers: [{ id: "basemap", type: "raster", source: "basemap" }],
    };

    const map = new maplibregl.Map({
      container: divRef.current,
      style: style as any,
      center: [-73.9778, 40.7067],
      zoom: 10,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "bottom-right");
    mapRef.current = map;

    const boxEl = document.createElement("div");
    boxEl.style.cssText = `
      position: absolute;
      border: 2px dashed rgba(255, 215, 0, 0.8);
      background: rgba(255, 215, 0, 0.1);
      pointer-events: none;
      display: none;
      z-index: 1000;
    `;
    divRef.current.appendChild(boxEl);
    boxElementRef.current = boxEl;

    map.on("load", () => {
      console.log("🗺️ Map loaded, adding layers...");
      const buildingsSource = map.getSource("buildings");
      const floodzonesSource = map.getSource("floodzones");
      const ntaSource = map.getSource("nta");
      
      console.log("📊 Source status:", {
        buildings: buildingsSource ? "✅ loaded" : "❌ not loaded",
        floodzones: floodzonesSource ? "✅ loaded" : "❌ not loaded",
        nta: ntaSource ? "✅ loaded" : "❌ not loaded",
      });

      if (buildingsSource) {
        console.log("🏢 Buildings source type:", buildingsSource.type);
      }
      if (floodzonesSource) {
        console.log("🌊 Floodzones source type:", floodzonesSource.type);
      }
      if (ntaSource) {
        console.log("🗺️ NTA source type:", ntaSource.type);
      }

      map.on("error", (e) => {
        console.error("🗺️ Map error:", e);
        if (e.error?.message) {
          console.error("Error message:", e.error.message);
        }
      });

      map.on("data", (e) => {
        if (e.dataType === "source" && e.isSourceLoaded) {
          console.log(`✅ Source loaded: ${e.sourceId}`, {
            type: map.getSource(e.sourceId)?.type,
          });
        }
      });

      map.addLayer({
        id: "floodzones-fill",
        type: "fill",
        source: "floodzones",
        "source-layer": floodzonesSourceLayer,
        paint: {
          "fill-color": COLOR_FLOODZONE_FILL,
          "fill-outline-color": COLOR_FLOODZONE_OUTLINE,
        },
        layout: {
          visibility: initialShowFloodzones ? "visible" : "none",
        },
      });

      map.addLayer({
        id: "floodzones-outline",
        type: "line",
        source: "floodzones",
        "source-layer": floodzonesSourceLayer,
        paint: {
          "line-color": COLOR_FLOODZONE_OUTLINE,
          "line-width": 1,
        },
        layout: {
          visibility: initialShowFloodzones ? "visible" : "none",
        },
      });

      map.addLayer({
        id: "nta-outline",
        type: "line",
        source: "nta",
        "source-layer": ntaSourceLayer,
        paint: {
          "line-color": "#ffffff",
          "line-width": 2.7,
          "line-dasharray": [2, 2],
        },
        layout: {
          visibility: initialShowNTA ? "visible" : "none",
        },
      });

      map.addLayer({
        id: "buildings-fill",
        type: "fill",
        source: "buildings",
        "source-layer": buildingsSourceLayer,
        paint: {
          "fill-color": fviExprForScenario(scenario),
          "fill-outline-color": "rgba(255,255,255,0.33)",
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["coalesce", ["to-number", ["get", scenario]], 0],
            0, 0.25,
            1, 1.0,
            5, 1.0,
          ],
        },
        layout: {
          visibility: initialShowBuildings ? "visible" : "none",
        },
      });

      map.addLayer({
        id: "buildings-stroke",
        type: "line",
        source: "buildings",
        "source-layer": buildingsSourceLayer,
        paint: {
          "line-color": "rgba(255,255,255,0.33)",
          "line-width": 0.33,
        },
        layout: {
          visibility: initialShowBuildings ? "visible" : "none",
        },
      });

      map.addLayer({
        id: "buildings-selected-glow",
        type: "line",
        source: "buildings",
        "source-layer": buildingsSourceLayer,
        paint: {
          "line-color": "rgba(255, 215, 0, 0.6)",
          "line-width": 8,
          "line-blur": 3,
        },
        filter: ["in", ["get", "objectid"], ["literal", []]] as any,
        layout: {
          visibility: "none",
        },
      });

      map.addLayer({
        id: "buildings-selected",
        type: "line",
        source: "buildings",
        "source-layer": buildingsSourceLayer,
        paint: {
          "line-color": COLOR_SELECTED_OUTLINE,
          "line-width": 4,
        },
        filter: ["in", ["get", "objectid"], ["literal", []]] as any,
        layout: {
          visibility: "none",
        },
      });


      map.on("mouseenter", "buildings-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "buildings-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("mouseenter", "nta-outline", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "nta-outline", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "buildings-fill", (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const oid = feat.properties?.objectid;
        if (!oid) return;
        
        const oidStr = String(oid);
        const currentIds = selectedBuildingIdsRef.current;
        
        const isOnlySelected = currentIds.size === 1 && currentIds.has(oidStr);
        
        if (isOnlySelected) {
          setSelectedBuildingIds(new Set());
          setSelectedBuilding(null);
          setSelectedNTA(null);
          setSelectedNTAFeature(null);
          setSelectedBorough(null);
          setCustomSelection(null);
          setBuildingFeaturesCache(new Map());
          if (map.getLayer("nta-outline")) {
            map.setPaintProperty("nta-outline", "line-color-transition", { duration: 300, delay: 0 });
            map.setPaintProperty("nta-outline", "line-color", "#ffffff");
          }
        } else {
          setSelectedBuildingIds(new Set([oidStr]));
          setSelectedBuilding({ objectid: oidStr, name: feat.properties?.name });
          setSelectedNTA(null);
          setSelectedNTAFeature(null);
          setSelectedBorough(null);
          setCustomSelection(null);
          setBuildingFeaturesCache(new Map([[oidStr, feat]]));
          if (map.getLayer("nta-outline")) {
            map.setPaintProperty("nta-outline", "line-color-transition", { duration: 300, delay: 0 });
            map.setPaintProperty("nta-outline", "line-color", "#ffffff");
          }
        }
        
        showBuildingPopup(map, e.lngLat, feat);
      });

      map.on("click", "nta-outline", (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const ntaCode = feat.properties?.NTACode;
        const ntaName = feat.properties?.NTAName || ntaCode;
        if (!ntaCode) return;

        const buildingsInView = map.queryRenderedFeatures(undefined, {
          layers: ["buildings-fill"],
        });

        const buildingIds = new Set<string>();
        buildingsInView.forEach((f) => {
          if (f.properties?.NTACode === ntaCode) {
            const oid = f.properties?.objectid;
            if (oid) buildingIds.add(String(oid));
          }
        });

        setSelectedBuildingIds(buildingIds);
        setSelectedNTA(String(ntaName));
        setSelectedNTAFeature(feat);
        setSelectedBuilding(null);
        setSelectedBorough(null);
        setCustomSelection(null);
        
        const ntaPopup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'nta-selection-popup'
        })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family:system-ui;font-size:12px; min-width:200px">
              <div style="font-weight:700; margin-bottom:4px">${ntaName}</div>
              <div style="color:#666">${formatInt(buildingIds.size)} buildings selected</div>
            </div>
          `)
          .addTo(map);
        
        setTimeout(() => {
          ntaPopup.remove();
        }, 2000);
        
        const featuresMap = new Map<string, any>();
        buildingsInView.forEach((f) => {
          if (f.properties?.NTACode === ntaCode) {
            const oid = f.properties?.objectid;
            if (oid) featuresMap.set(String(oid), f);
          }
        });
        setBuildingFeaturesCache(featuresMap);
        
        map.setPaintProperty("nta-outline", "line-color-transition", { duration: 300, delay: 0 });
        map.setPaintProperty("nta-outline", "line-color", [
          "case",
          ["==", ["get", "NTACode"], ntaCode],
          "#00ff00",
          "rgba(255,255,255,0.6)"
        ] as any);
      });

      map.on("click", (e) => {
        if (!lassoModeRef.current) {
          const features = map.queryRenderedFeatures(e.point);
          if (features.length === 0) {
            setSelectedBuildingIds(new Set());
            setSelectedNTA(null);
            setSelectedNTAFeature(null);
            setSelectedBuilding(null);
            setSelectedBorough(null);
            setCustomSelection(null);
            setBuildingFeaturesCache(new Map());
            if (map.getLayer("nta-outline")) {
              map.setPaintProperty("nta-outline", "line-color-transition", { duration: 300, delay: 0 });
              map.setPaintProperty("nta-outline", "line-color", "#ffffff");
            }
          }
        }
      });

        map.on("mousedown", (e) => {
        if (lassoModeRef.current && e.originalEvent.button === 0) {
          e.preventDefault();
          e.stopPropagation();
          isDraggingRef.current = true;
          const startPoint = { x: e.point.x, y: e.point.y };
          boxStartRef.current = startPoint;
          isBoxSelectingRef.current = true;
          if (boxElementRef.current) {
            boxElementRef.current.style.display = "block";
            boxElementRef.current.style.left = `${startPoint.x}px`;
            boxElementRef.current.style.top = `${startPoint.y}px`;
            boxElementRef.current.style.width = "0px";
            boxElementRef.current.style.height = "0px";
          }
          map.dragPan.disable();
          map.boxZoom.disable();
        } else if (lassoModeRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      });

      map.on("mousemove", (e) => {
        if (lassoModeRef.current && isDraggingRef.current && boxStartRef.current && boxElementRef.current) {
          const width = e.point.x - boxStartRef.current.x;
          const height = e.point.y - boxStartRef.current.y;
          boxElementRef.current.style.width = `${Math.abs(width)}px`;
          boxElementRef.current.style.height = `${Math.abs(height)}px`;
          boxElementRef.current.style.left = `${Math.min(boxStartRef.current.x, e.point.x)}px`;
          boxElementRef.current.style.top = `${Math.min(boxStartRef.current.y, e.point.y)}px`;
        }
      });

      map.on("mouseup", (e) => {
        if (lassoModeRef.current && isDraggingRef.current && boxStartRef.current) {
          isDraggingRef.current = false;
          const startPoint: maplibregl.PointLike = [
            boxStartRef.current.x,
            boxStartRef.current.y,
          ];
          const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
            startPoint,
            e.point,
          ];

          const features = map.queryRenderedFeatures(bbox, {
            layers: ["buildings-fill"],
          });

          const newIds = new Set<string>();
          const featuresMap = new Map<string, any>();
          features.forEach((f) => {
            const oid = f.properties?.objectid;
            if (oid) {
              newIds.add(String(oid));
              featuresMap.set(String(oid), f);
            }
          });

          if (features.length > 0) {
            const startLngLat = map.unproject(startPoint);
            const endLngLat = map.unproject(e.point);
            
            const bounds = new maplibregl.LngLatBounds(
              [Math.min(startLngLat.lng, endLngLat.lng), Math.min(startLngLat.lat, endLngLat.lat)],
              [Math.max(startLngLat.lng, endLngLat.lng), Math.max(startLngLat.lat, endLngLat.lat)]
            );
            
            map.fitBounds(bounds, {
              padding: { top: 50, bottom: 50, left: 50, right: 50 },
              duration: 500,
              maxZoom: 18
            });
          }

          setSelectedBuildingIds(newIds);
          setSelectedNTA(null);
          setSelectedNTAFeature(null);
          setSelectedBuilding(null);
          setSelectedBorough(null);
          setCustomSelection({ type: "custom", bounds: bbox });
          setBuildingFeaturesCache(featuresMap);
          if (map.getLayer("nta-outline")) {
            map.setPaintProperty("nta-outline", "line-color-transition", { duration: 300, delay: 0 });
            map.setPaintProperty("nta-outline", "line-color", "#ffffff");
          }

          if (boxElementRef.current) {
            boxElementRef.current.style.display = "none";
          }
          isBoxSelectingRef.current = false;
          boxStartRef.current = null;
          map.dragPan.enable();
          map.boxZoom.enable();
        }
      });

      map.on("mouseleave", () => {
        if (lassoModeRef.current && isDraggingRef.current) {
          isDraggingRef.current = false;
          if (boxElementRef.current) {
            boxElementRef.current.style.display = "none";
          }
          isBoxSelectingRef.current = false;
          boxStartRef.current = null;
          map.dragPan.enable();
          if (!lassoModeRef.current) {
            map.boxZoom.enable();
          }
        }
      });

    });
    
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("buildings-selected")) return;

    const ids = Array.from(selectedBuildingIds);
    const hasSelection = ids.length > 0;
    
    if (hasSelection) {
      const filter: any = [
        "in",
        ["get", "objectid"],
        ["literal", ids],
      ];
      map.setFilter("buildings-selected", filter);
      map.setFilter("buildings-selected-glow", filter);
      map.setLayoutProperty("buildings-selected", "visibility", "visible");
      map.setLayoutProperty("buildings-selected-glow", "visibility", "visible");
    } else {
      map.setLayoutProperty("buildings-selected", "visibility", "none");
      map.setLayoutProperty("buildings-selected-glow", "visibility", "none");
    }
    
    if (map.getLayer("buildings-fill")) {
      map.setPaintProperty(
        "buildings-fill",
        "fill-color",
        fviExprForScenario(scenario)
      );
      
      if (hasSelection) {
        map.setPaintProperty(
          "buildings-fill",
          "fill-opacity",
          [
            "case",
            ["in", ["get", "objectid"], ["literal", ids]],
            1.0,
            0.4,
          ] as any
        );
        map.setPaintProperty(
          "buildings-fill",
          "fill-opacity-transition",
          { duration: 300, delay: 0 }
        );
      } else {
        map.setPaintProperty(
          "buildings-fill",
          "fill-opacity",
          [
            "interpolate",
            ["linear"],
            ["coalesce", ["to-number", ["get", scenario]], 0],
            0, 0.25,
            1, 1.0,
            5, 1.0,
          ] as any
        );
      }
    }
  }, [selectedBuildingIds, scenario]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.getLayer("buildings-fill")) {
      map.setPaintProperty(
        "buildings-fill",
        "fill-color-transition",
        { duration: 300, delay: 0 }
      );
      map.setPaintProperty(
        "buildings-fill",
        "fill-color",
        fviExprForScenario(scenario)
      );
    }

    if (map.getLayer("floodzones-fill")) {
      map.setPaintProperty(
        "floodzones-fill",
        "fill-color-transition",
        { duration: 300, delay: 0 }
      );
      map.setFilter("floodzones-fill", ["==", ["get", "scenario"], scenario]);
      map.setFilter("floodzones-outline", ["==", ["get", "scenario"], scenario]);
    }
  }, [scenario, selectedBuildingIds.size]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("nta-outline")) return;

    if (selectedNTAFeature && selectedNTAFeature.properties?.NTACode) {
      const ntaCode = selectedNTAFeature.properties.NTACode;
      map.setPaintProperty("nta-outline", "line-color-transition", { duration: 300, delay: 0 });
      map.setPaintProperty("nta-outline", "line-color", [
        "case",
        ["==", ["get", "NTACode"], ntaCode],
        "#00ff00",
        "rgba(255,255,255,0.6)"
      ] as any);
    } else {
      map.setPaintProperty("nta-outline", "line-color-transition", { duration: 300, delay: 0 });
      map.setPaintProperty("nta-outline", "line-color", "#ffffff");
    }
  }, [selectedNTAFeature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.getLayer("buildings-fill")) {
      const vis = showBuildings ? "visible" : "none";
      map.setLayoutProperty("buildings-fill", "visibility", vis);
      map.setLayoutProperty("buildings-stroke", "visibility", vis);
      map.setLayoutProperty("buildings-selected-glow", "visibility", vis);
      map.setLayoutProperty("buildings-selected", "visibility", vis);
    }

    if (map.getLayer("floodzones-fill")) {
      const vis = showFloodzones ? "visible" : "none";
      map.setLayoutProperty("floodzones-fill", "visibility", vis);
      map.setLayoutProperty("floodzones-outline", "visibility", vis);
    }

    if (map.getLayer("nta-outline")) {
      map.setLayoutProperty(
        "nta-outline",
        "visibility",
        showNTA ? "visible" : "none"
      );
    }
  }, [showBuildings, showFloodzones, showNTA]);

  const calculateSelectionStats = useCallback(() => {
    if (selectedBuildingIds.size === 0 || buildingFeaturesCache.size === 0) {
      return null;
    }

    const stats: {
      total_area: number;
      total_count: number;
      area_by: Record<string, number>;
      count_by: Record<string, number>;
    } = {
      total_area: 0,
      total_count: 0,
      area_by: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
      count_by: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
    };

    selectedBuildingIds.forEach((oid) => {
      const feat = buildingFeaturesCache.get(oid);
      if (!feat) return;
      
      const props = feat.properties || {};
      const area = props.geom_area_sqft ? Number(props.geom_area_sqft) : 0;
      const fvi = props[scenario] ? Number(props[scenario]) : 0;
      
      if (fvi >= 1 && fvi <= 5) {
        const fviStr = String(Math.floor(fvi));
        stats.total_area += area;
        stats.total_count += 1;
        stats.area_by[fviStr] = (stats.area_by[fviStr] || 0) + area;
        stats.count_by[fviStr] = (stats.count_by[fviStr] || 0) + 1;
      }
    });

    return stats;
  }, [selectedBuildingIds, buildingFeaturesCache, scenario]);

  const getSelectedZoneText = useCallback(() => {
    if (selectedBuilding) {
      if (selectedBuilding.name) {
        return `${selectedBuilding.name} (${selectedBuilding.objectid})`;
      }
      return `Building ${selectedBuilding.objectid}`;
    }
    if (selectedNTAFeature) {
      return selectedNTAFeature.properties?.NTAName || selectedNTA || "Neighborhood";
    }
    if (selectedBorough) {
      return selectedBorough;
    }
    if (customSelection) {
      const bounds = customSelection.bounds;
      if (bounds && Array.isArray(bounds) && bounds.length >= 2) {
        const start = bounds[0];
        const end = bounds[1];
        if (Array.isArray(start) && Array.isArray(end)) {
          const centerX = (start[0] + end[0]) / 2;
          const centerY = (start[1] + end[1]) / 2;
          return `Custom Selection (${centerX.toFixed(2)}, ${centerY.toFixed(2)})`;
        }
      }
      return "Custom Selection";
    }
    return "New York City";
  }, [selectedBuilding, selectedNTAFeature, selectedNTA, selectedBorough, customSelection]);

  useEffect(() => {
    const stats = calculateSelectionStats();
    const zoneText = getSelectedZoneText();
    onSelectionChange?.(
      selectedBuildingIds,
      selectedNTA || undefined,
      selectedBuilding || undefined,
      selectedBorough || undefined,
      customSelection || undefined,
      stats || undefined,
      zoneText
    );
  }, [selectedBuildingIds, selectedNTA, selectedBuilding, selectedBorough, customSelection, calculateSelectionStats, getSelectedZoneText, onSelectionChange]);

  const showBuildingPopup = (
    map: maplibregl.Map,
    lngLat: maplibregl.LngLat,
    feature: any
  ) => {
    const p = feature.properties || {};
    const oid = p.objectid ?? "—";
    const name = p.name ?? "";
    const nta = p.NTAName ?? "—";
    const boro = p.boroname ?? "—";
    const area =
      p.geom_area_sqft != null && !isNaN(Number(p.geom_area_sqft))
        ? Math.round(Number(p.geom_area_sqft)).toLocaleString()
        : "—";
    const year = p.construction_year ?? "—";

    let rows = "";
    for (const key of SCENARIOS) {
      const label = SCENARIO_LABELS[key];
      const v = p[key] == null || p[key] === "" ? "—" : p[key];
      rows += `<div style="margin-bottom:4px"><span style="color:#374151;font-weight:600">${label}:</span> <span style="color:#111827">${v}</span></div>`;
    }

    const nameDisplay = name ? `<div style="margin-bottom:6px"><span style="color:#374151;font-weight:600">Name:</span> <span style="color:#111827">${name}</span></div>` : "";

    const popupHtml = `
      <div style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;min-width:300px;color:#111827;padding:4px">
        <div style="margin-bottom:6px"><span style="color:#374151;font-weight:600">Object ID:</span> <span style="color:#111827">${oid}</span></div>
        ${nameDisplay}
        <div style="margin-bottom:4px"><span style="color:#374151;font-weight:600">NTA:</span> <span style="color:#111827">${nta}</span></div>
        <div style="margin-bottom:4px"><span style="color:#374151;font-weight:600">Borough:</span> <span style="color:#111827">${boro}</span></div>
        <div style="margin-bottom:4px"><span style="color:#374151;font-weight:600">Area (sq ft):</span> <span style="color:#111827">${area}</span></div>
        <div style="margin-bottom:8px"><span style="color:#374151;font-weight:600">Construction Year:</span> <span style="color:#111827">${year}</span></div>
        <div style="height:1px;background:rgba(0,0,0,0.12);margin:8px 0;"></div>
        <div style="color:#111827;font-weight:700;margin-bottom:6px;font-size:13px">Flood Vulnerability Index</div>
        ${rows}
      </div>
    `;

    new maplibregl.Popup().setLngLat(lngLat).setHTML(popupHtml).addTo(map);
  };

  useEffect(() => {
    setScenario(initialScenario);
  }, [initialScenario]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={divRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
