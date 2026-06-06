import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Hash, Plus, Save, Trash2 } from "lucide-react";
import { hashtagsApi } from "../api/services";

const categorySuggestions = ["Marketing", "Branding", "Product", "Event", "Trending"];

function normalizeTag(value) {
  const cleaned = String(value || "").trim().toLowerCase();
  if (!cleaned) return "";
  return cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
}

export default function NewHashtag() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([{ tag: "", category: "" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "New Hashtag | Smart Social";
  }, []);

  function updateRow(index, key, value) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: key === "tag" ? value.toLowerCase() : value } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { tag: "", category: "" }]);
  }

  function removeRow(index) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const payloads = rows
      .map((row) => ({ tag: normalizeTag(row.tag), category: row.category.trim() || "Marketing" }))
      .filter((row) => row.tag);

    if (!payloads.length) {
      toast.error("Add at least one hashtag.");
      return;
    }

    setSaving(true);
    try {
      await Promise.all(payloads.map((payload) => hashtagsApi.create(payload)));
      toast.success(`${payloads.length} hashtags added!`, { duration: 3000 });
      navigate("/hashtags");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to add hashtags.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-6">
      <button type="button" className="inline-flex items-center gap-2 font-bold text-slate-500 hover:text-brand-orange" onClick={() => navigate("/hashtags")}>
        <ArrowLeft className="h-4 w-4" />
        Back to hashtags
      </button>

      <form className="app-surface mx-auto max-w-lg p-6 md:p-8" onSubmit={handleSubmit}>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-brand-orange">
            <Hash className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Build your reusable hashtag library</p>
            <h1 className="text-3xl font-bold text-slate-950">New Hashtag</h1>
          </div>
        </div>

        <datalist id="hashtag-categories">
          {categorySuggestions.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>

        <div className="mt-8 space-y-4">
          {rows.map((row, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-slate-700">Hashtag {index + 1}</p>
                {rows.length > 1 ? (
                  <button type="button" className="rounded-full p-2 text-rose-500 hover:bg-rose-50" onClick={() => removeRow(index)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <label className="mt-4 block">
                <span className="text-sm font-bold text-slate-700">Hashtag</span>
                <input
                  className="app-input mt-2"
                  value={row.tag}
                  onChange={(event) => updateRow(index, "tag", event.target.value)}
                  onBlur={(event) => updateRow(index, "tag", normalizeTag(event.target.value))}
                  placeholder="#creatorflow"
                />
              </label>
              <label className="mt-4 block">
                <span className="text-sm font-bold text-slate-700">Category</span>
                <input
                  className="app-input mt-2"
                  list="hashtag-categories"
                  value={row.category}
                  onChange={(event) => updateRow(index, "category", event.target.value)}
                  placeholder="Marketing"
                />
              </label>
            </div>
          ))}
        </div>

        <button type="button" className="mt-5 inline-flex items-center gap-2 font-bold text-brand-purple hover:text-brand-orange" onClick={addRow}>
          <Plus className="h-4 w-4" />
          Add Another
        </button>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="app-button-secondary" onClick={() => navigate("/hashtags")}>
            Cancel
          </button>
          <button type="submit" className="app-button-primary gap-2" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Adding..." : "Add Hashtags"}
          </button>
        </div>
      </form>
    </main>
  );
}
