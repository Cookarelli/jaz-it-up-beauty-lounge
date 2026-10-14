import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase";
import { ServiceFields } from "@/components/service-fields";
import { categories, type Service } from "@/lib/service-types";
export default async function Services() {
  const db = await adminClient();
  if (!db) redirect("/admin/login");
  const [s, v] = await Promise.all([
    db.from("services").select("*").order("display_order"),
    db.from("service_variants").select("*").order("display_order"),
  ]);
  if (s.error || v.error) throw Error("Catalog unavailable");
  return (
    <>
      <h2>Service catalog</h2>
      <p>
        Published entries remain visible while awaiting review. Only approved
        exact or starting prices with approved exact durations can be booked.
        Leave unknown fields blank. Archiving preserves existing appointments.
        Buffers default to zero until configured by the owner.
      </p>
      {categories.map((category) => (
        <div key={category}>
          <h2>{category}</h2>
          {(s.data as Service[])
            .filter((x) => x.category === category)
            .map((service) => (
              <details className="card" key={service.id}>
                <summary>
                  {service.name} · {service.status}
                </summary>
                <ServiceFields
                  key={`${service.id}-${service.revision}`}
                  service={service}
                />
                {(v.data as Service[])
                  .filter((x) => x.service_id === service.id)
                  .map((variant) => (
                    <details className="card" key={variant.id}>
                      <summary>Variant: {variant.name}</summary>
                      <ServiceFields
                        key={`${variant.id}-${variant.revision}`}
                        service={variant}
                        kind="variant"
                      />
                    </details>
                  ))}
              </details>
            ))}
        </div>
      ))}
    </>
  );
}
