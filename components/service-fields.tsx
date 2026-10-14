import type { Service } from "@/lib/catalog";
export function ServiceFields({ service }: { service?: Service }) {
  return (
    <>
      {service && <input type="hidden" name="id" value={service.id} />}
      <label>
        Name
        <input
          name="name"
          required
          defaultValue={service?.name}
          maxLength={100}
        />
      </label>
      <label>
        Description
        <input
          name="description"
          defaultValue={service?.description}
          maxLength={500}
        />
      </label>
      <label>
        Category
        <input name="category" required defaultValue={service?.category} />
      </label>
      <label>
        Duration (minutes)
        <input
          name="duration_minutes"
          type="number"
          required
          min={15}
          max={480}
          defaultValue={service?.duration_minutes || 60}
        />
      </label>
      <label>
        Price (cents)
        <input
          name="price_cents"
          type="number"
          required
          min={0}
          max={1000000}
          defaultValue={service?.price_cents || 0}
        />
      </label>
      {service && (
        <label>
          Published
          <input
            type="checkbox"
            name="active"
            defaultChecked={(service as Service & { active: boolean }).active}
          />
        </label>
      )}
      <button>Save service</button>
    </>
  );
}
