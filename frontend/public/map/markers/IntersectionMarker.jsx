import { Marker } from "react-map-gl";

export default function IntersectionMarker({ lat, lng }) {
  return (
    <Marker latitude={lat} longitude={lng} anchor="center">
      <div
        style={{
          width: 10,
          height: 10,
          background: "red",
          borderRadius: "50%",
        }}
      />
    </Marker>
  );
}
