import { useState } from "react";

import {driverPortrait} from "./driverPortrait";
const fields = [
  ["name", "Nombre completo", "Full name"],
  ["color", "Color del vehículo", "Vehicle color"],

  ["plate", "Placa", "License plate"],
  ["brand", "Marca", "Make"],
  ["model", "Modelo", "Model"],
];

const photos = [
  ["licensePhoto", "Licencia", "Driver's license"],
  ["vehiclePhoto", "Vehículo", "Vehicle"],

  ["registrationPhoto", "Registro", "Registration"],
  ["insurancePhoto", "Seguro del vehículo", "Vehicle insurance"],
];

export function DriverForm({ en, onSubmit, credentialsFields }) {
  const [values, setValues] = useState({});

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");
  const [step,setStep]=useState(0);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      if (fields.some(([key]) => !values[key]?.trim()))
        throw Error(en ? "Complete all fields." : "Completa todos los campos.");

      if (!values.portraitFile) throw Error(en?"Add a driver photo to continue.":"Añade una foto del conductor para continuar.");
      const documents = {};

      for (const [key] of photos) {
        const file = values[key];

        if (
          !file ||
          !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type) ||
          file.size > 10 * 1024 * 1024
        )
          throw Error(
            en
              ? "Each file must be JPG, PNG, WebP or PDF and no larger than 10 MB."
              : "Cada archivo debe ser JPG, PNG, WebP o PDF y pesar máximo 10 MB.",
          );

        documents[key] = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = reject;
          r.readAsDataURL(file);
        });
      }

      await onSubmit({
        ...Object.fromEntries(fields.map(([key]) => [key, values[key].trim()])),
        documents,
        portrait:await driverPortrait(values.portraitFile,en),
      });
    } catch (e) {
      setError(e.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel driver-registration" onSubmit={submit}>
      <p role="status">{en?"Step":"Paso"} {step+1} / 3 · {en?["Your details","Vehicle","Documents"][step]:["Tus datos","Vehículo","Documentos"][step]}</p>
      <div className="registration-section" hidden={step !== 0}>
        <h3>{en ? "Your details" : "Tus datos"}</h3>

        <label>
          {en ? "Full name" : "Nombre completo"}
          <input
            required
            autoComplete="name"
            value={values.name || ""}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
          />
        </label>

        <label>{en?"Driver photo (required)":"Foto del conductor (obligatoria)"}<input required type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setValues({...values,portraitFile:e.target.files[0]})}/></label>
        {credentialsFields}

        {credentialsFields && (
          <small>
            {en
              ? "Password must be at least 10 characters."
              : "La contraseña debe tener al menos 10 caracteres."}
          </small>
        )}
      </div>

      <div className="registration-section" hidden={step !== 1}>
        <h3>{en ? "Your vehicle" : "Tu vehículo"}</h3>
        <div className="registration-grid">
          {fields.slice(1).map(([key, es, english]) => (
            <label key={key}>
              {en ? english : es}
              <input
                required
                value={values[key] || ""}
                onChange={(e) =>
                  setValues({ ...values, [key]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
      </div>

      <div className="registration-section" hidden={step !== 2}>
        <h3>{en ? "Documents" : "Documentos"}</h3>
        <p>
          {en
            ? "Upload a clear file for each document and your vehicle. JPG, PNG, WebP or PDF, up to 10 MB each."
            : "Sube un archivo claro de cada documento y de tu vehículo. JPG, PNG, WebP o PDF, máximo 10 MB cada uno."}
        </p>

        <div className="registration-docs">
          {photos.map(([key, es, english]) => (
            <label key={key}>
              <strong>{en ? english : es}</strong>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
                required
                onChange={(e) =>
                  setValues({ ...values, [key]: e.target.files[0] })
                }
              />
            </label>
          ))}
        </div>
      </div>

      {step === 2 && <p className="review-note">
        {en
          ? "After sending, your documents will be reviewed by the administrator."
          : "Después de enviarlos, el administrador revisará tus documentos y te informará su decisión."}
      </p>}

      {error && <p role="alert">{error}</p>}
      {step > 0 && <button type="button" className="outline" onClick={()=>setStep(step-1)}>{en?"Back":"Atrás"}</button>}
      {step < 2 && <button type="button" className="primary full" onClick={e=>{const section=e.currentTarget.form.querySelectorAll(".registration-section")[step];for(const input of section.querySelectorAll("input")){if(!input.reportValidity())return;}setStep(step+1);}}>{en?"Continue":"Continuar"}</button>}
      {step === 2 && <button className="primary full" disabled={busy}>
        {busy
          ? en
            ? "Sending…"
            : "Enviando…"
          : en
            ? "Submit application"
            : "Enviar solicitud"}
      </button>}
    </form>
  );
}

export function DriverDocuments({ driver, en, expanded = false }) {
  const [view, setView] = useState(null);

  if (!driver.documents) return null;

  const grid = (
    <div className="document-grid">
      {photos.map(([key, es, english]) =>
        driver.documents[key] ? (
          <figure key={key}>
            <figcaption>{en ? english : es}</figcaption>

            <button
              type="button"
              onClick={() =>
                setView({
                  src: driver.documents[key],
                  label: en ? english : es,
                })
              }
            >
              {driver.documents[key].startsWith("data:application/pdf;") ? <div className="document-pdf" aria-hidden="true">PDF</div> : <img src={driver.documents[key]} alt={en ? english : es} />}
              <span>{driver.documents[key].startsWith("data:application/pdf;") ? (en ? "Open PDF" : "Abrir PDF") : (en ? "Open photo" : "Abrir foto")} ↗</span>
            </button>
          </figure>
        ) : (
          <figure key={key}>
            <figcaption>{en ? english : es}</figcaption>
            <p>{en ? "Not provided" : "No enviado"}</p>
          </figure>
        ),
      )}
    </div>
  );

  return (
    <>
      {expanded ? (
        grid
      ) : (
        <details>
          <summary>{en ? "Review photos" : "Revisar fotos"}</summary>
          {grid}
        </details>
      )}

      {view && (
        <div
          className="photo-viewer"
          role="dialog"
          aria-label={view.label}
          onClick={() => setView(null)}
        >
          <button
            type="button"
            className="photo-close"
            onClick={() => setView(null)}
          >
            {en ? "Close" : "Cerrar"}
          </button>

          {view.src.startsWith("data:application/pdf;") ? <iframe title={view.label} src={view.src} onClick={(e) => e.stopPropagation()} /> : <img src={view.src} alt={view.label} onClick={(e) => e.stopPropagation()} />}
        </div>
      )}
    </>
  );
}
