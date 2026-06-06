import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Megaphone, Save } from "lucide-react";
import { campaignsApi } from "../api/services";

export default function NewCampaign() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    description: "",
    startDate: null,
    endDate: null,
    budget: "",
    status: "draft"
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "New Campaign | Smart Social";
  }, []);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("Campaign name is required.");
      return;
    }

    setSaving(true);
    try {
      const campaign = await campaignsApi.create({
        name: form.name.trim(),
        objective: form.description.trim() || "Campaign growth",
        description: form.description.trim(),
        starts_at: form.startDate ? form.startDate.toISOString() : null,
        ends_at: form.endDate ? form.endDate.toISOString() : null,
        budget: form.budget ? Number(form.budget) : null,
        status: form.status
      });
      toast.success("Campaign created!", { duration: 3000 });
      navigate(`/campaigns/${campaign.id}`);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to create campaign.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-6">
      <button type="button" className="inline-flex items-center gap-2 font-bold text-slate-500 hover:text-brand-orange" onClick={() => navigate("/campaigns")}>
        <ArrowLeft className="h-4 w-4" />
        Back to campaigns
      </button>

      <form className="app-surface mx-auto max-w-2xl p-6 md:p-8" onSubmit={handleSubmit}>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-brand-orange">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Create a new workspace campaign</p>
            <h1 className="text-3xl font-bold text-slate-950">New Campaign</h1>
          </div>
        </div>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">Campaign Name</span>
            <input className="app-input mt-2" value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Summer creator launch" required />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">Description</span>
            <textarea
              className="app-input mt-2 min-h-32"
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Describe the campaign goal, audience, and creative direction."
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Start Date</span>
              <DatePicker selected={form.startDate} onChange={(date) => updateField("startDate", date)} className="app-input mt-2" placeholderText="Select start date" />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">End Date</span>
              <DatePicker
                selected={form.endDate}
                onChange={(date) => updateField("endDate", date)}
                minDate={form.startDate}
                className="app-input mt-2"
                placeholderText="Select end date"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Budget</span>
              <div className="relative mt-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                <input className="app-input pl-9" value={form.budget} type="number" min="0" onChange={(event) => updateField("budget", event.target.value)} placeholder="50000" />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Status</span>
              <select className="app-input mt-2" value={form.status} onChange={(event) => updateField("status", event.target.value)}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="app-button-secondary" onClick={() => navigate("/campaigns")}>
            Cancel
          </button>
          <button type="submit" className="app-button-primary gap-2" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Creating..." : "Create Campaign"}
          </button>
        </div>
      </form>
    </main>
  );
}
