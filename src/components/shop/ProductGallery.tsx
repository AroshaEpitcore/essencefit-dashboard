/* Shows the product's images as a grid (up to a 2×2 of four). Switches with the
   selected colour because the parent passes the active image set. No zoom. */
export default function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const list = images.length ? images : [];

  if (list.length === 0) {
    return <div className="aspect-square  bg-gray-100 flex items-center justify-center text-gray-300">No image</div>;
  }

  if (list.length === 1) {
    return (
      <div className="aspect-square  overflow-hidden bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={list[0]} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      {list.map((url, i) => (
        <div key={url + i} className="aspect-square  overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`${name} ${i + 1}`} className="w-full h-full object-cover" />
        </div>
      ))}
    </div>
  );
}
