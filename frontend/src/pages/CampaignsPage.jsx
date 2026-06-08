/* This page renders campaign cards, creation, and campaign analytics detail. */
import { useCallback, useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { campaignsApi } from "../api/services";
import { useSocketEvent } from "../hooks/useSocket";
import { EVENTS } from "../socket/events";
import { DataTable, PageCard, StatusBadge } from "../components/shared/Ui";

export default function CampaignsPage() {
  const [payload, setPayload] = useState({ items: [], pagination: null });
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [form, setForm] = useState({ name: "", objective: "", budget: "" });

  const refreshCampaignList = useCallback(async () => {
    const response = await campaignsApi.list();
    setPayload(response);
    setSelectedCampaign((current) => {
      if (!response.items.length) {
        return null;
      }

      if (!current) {
        return response.items[0];
      }

      return response.items.find((campaign) => String(campaign.id) === String(current.id)) || response.items[0];
    });
  }, []);

  const refreshSelectedCampaignAnalytics = useCallback(async () => {
    if (!selectedCampaign?.id) {
      return;
    }

    const campaignAnalytics = await campaignsApi.analytics(selectedCampaign.id);
    setAnalytics(campaignAnalytics);
  }, [selectedCampaign]);

  useEffect(() => {
    refreshCampaignList().catch(() => {});
  }, [refreshCampaignList]);

  useEffect(() => {
    if (!selectedCampaign) {
      return;
    }
    refreshSelectedCampaignAnalytics().catch(() => {});
  }, [refreshSelectedCampaignAnalytics, selectedCampaign]);

  useSocketEvent(
    EVENTS.POST_PUBLISHED,
    useCallback(() => {
      refreshCampaignList().catch(() => {});
      refreshSelectedCampaignAnalytics().catch(() => {});
    }, [refreshCampaignList, refreshSelectedCampaignAnalytics])
  );

  async function createCampaign(event) {
    event.preventDefault();
    await campaignsApi.create(form);
    await refreshCampaignList();
    setForm({ name: "", objective: "", budget: "" });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <PageCard title="Campaigns" subtitle="Create and manage campaign programs">
          <div className="grid gap-4 md:grid-cols-2">
            {payload.items.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                onClick={() => setSelectedCampaign(campaign)}
                className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5 text-left"
              >
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold text-white">{campaign.name}</p>
                  <StatusBadge>{campaign.status}</StatusBadge>
                </div>
                <p className="mt-3 text-sm text-slate-400">{campaign.objective}</p>
                <p className="mt-3 text-sm text-slate-300">${campaign.budget}</p>
              </button>
            ))}
          </div>
        </PageCard>

        <PageCard title="Create campaign">
          <form className="grid gap-4" onSubmit={createCampaign}>
            <input className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" placeholder="Campaign name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            <input className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" placeholder="Objective" value={form.objective} onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))} />
            <input className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" placeholder="Budget" value={form.budget} onChange={(event) => setForm((current) => ({ ...current, budget: event.target.value }))} />
            <button type="submit" className="rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950">Create campaign</button>
          </form>
        </PageCard>
      </section>

      {selectedCampaign && analytics ? (
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <PageCard title={`${selectedCampaign.name} performance`} subtitle="Linked posts and total analytics">
            <DataTable
              columns={[
                { key: "title", label: "Linked post" },
                { key: "status", label: "Status", render: (row) => row.publish_status },
                { key: "reach", label: "Reach", render: (row) => row.analytics?.reach_count || 0 }
              ]}
              rows={analytics.posts}
            />
          </PageCard>

          <PageCard title="Daily campaign performance">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.daily}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="collected_at" stroke="#64748b" tickFormatter={(value) => value.slice(5, 10)} />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Area type="monotone" dataKey="engagement_count" stroke="#34d399" fill="#34d39933" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </PageCard>
        </section>
      ) : null}
    </div>
  );
}
