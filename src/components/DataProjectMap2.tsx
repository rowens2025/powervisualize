export default function DataProjectMap() {
  return (
    <div className="w-full h-[80vh] rounded-xl overflow-hidden border border-neutral-800">
      <iframe
        src="/maps/nyc_flood_risk_nta.html"
        title="NYC Flood Risk Map by Building"
        className="w-full h-full"
        loading="lazy"
      />
    </div>
  );
}
