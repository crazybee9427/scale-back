import axios from "axios";
import dns from "dns";

const workspaces = {
  SYL: "19|TomzFAXJCX6fQJJv38cFmRn1ADHamTcvvSR1SBIg8025c263",
  GBM: "17|kiTKEVf78G1S3ujaCjIkmMkcMijWQTdfWIPl3Tfc85e77be8",
  GF: "32|179zGn7vlGk8sZiRRdSHpM57I5WVQN8DbrAjovA9a5bb6d86",
  "Report It": "45|1sCsrOPVlhwnyZyJQBvLXwIUfVVjIH3kaxZsxmomc2a5fd78",
};

const apiUrl = "https://mail.scaleyourleads.com";

const getBasicCampaignData = async (apiKey) => {
  const options = {
    method: "GET",
    url: `${apiUrl}/api/campaigns`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    data: {
      status: "active",
    },
  };

  try {
    const { data } = await axios.request(options);
    return Array.isArray(data) ? data : data.data;
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    throw error;
  }
};

const getSenderEmailsForCampaign = async (campaignId, apiKey) => {
  const options = {
    method: "GET",
    url: `${apiUrl}/api/campaigns/${campaignId}/sender-emails`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  };

  try {
    const { data } = await axios.request(options);
    return data.data;
  } catch (error) {
    console.error(
      `Error fetching sender emails for campaign ${campaignId}:`,
      error
    );
    throw error;
  }
};

const getScheduledEmailsForCampaign = async (campaignId, apiKey) => {
  const today = new Date();
  const scheduled_date = today.toISOString().split("T")[0];

  const options = {
    method: "GET",
    url: `${apiUrl}/api/campaigns/${campaignId}/scheduled-emails`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    data: {
      status: "scheduled",
      scheduled_date: `${scheduled_date}T00:00:00`,
      scheduled_date_local: `${scheduled_date}T00:00:00`,
    },
  };

  try {
    const { data } = await axios.request(options);
    return data;
  } catch (error) {
    console.error(
      `Error fetching scheduled emails for campaign ${campaignId}:`,
      error
    );
    throw error;
  }
};

const getMonthDates = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  return {
    startDate: firstDay.toISOString().split("T")[0],
    endDate: lastDay.toISOString().split("T")[0],
  };
};

const getLastNMonthsDates = (numberOfMonths) => {
  const today = new Date();
  const dates = [];

  for (let i = 0; i < numberOfMonths; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    dates.push({
      year: date.getFullYear(),
      month: date.getMonth(),
      dates: getMonthDates(date.getFullYear(), date.getMonth()),
    });
  }

  return dates;
};

const getCampaignStats = async (campaignId, apiKey, numberOfMonths = 12) => {
  const dates = getLastNMonthsDates(numberOfMonths);
  const monthlyStats = [];

  for (const date of dates) {
    const options = {
      method: "POST",
      url: `${apiUrl}/api/campaigns/${campaignId}/stats`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      data: {
        start_date: date.dates.startDate,
        end_date: date.dates.endDate,
      },
    };

    try {
      const { data } = await axios.request(options);
      monthlyStats.push({
        year: date.year,
        month: date.month + 1,
        stats: data.data,
      });
    } catch (error) {
      console.error(
        `Error fetching campaign stats for ${campaignId} for ${date.year}-${
          date.month + 1
        }:`,
        error
      );
      throw error;
    }
  }

  return monthlyStats;
};

const getCampaignDetails = async (campaignId, apiKey) => {
  const [senderEmails, scheduledEmails, monthlyStats] = await Promise.all([
    getSenderEmailsForCampaign(campaignId, apiKey),
    getScheduledEmailsForCampaign(campaignId, apiKey),
    getCampaignStats(campaignId, apiKey),
  ]);

  const maxDailyCapacity = calculateMaxDailyCapacity(senderEmails);

  const scheduledEmailsCount = scheduledEmails?.data?.length || 0;

  const aggregatedStats = monthlyStats.reduce(
    (acc, monthData) => {
      if (!monthData?.stats) return acc;

      const stats = monthData.stats;
      return {
        emails_sent:
          parseInt(acc.emails_sent || 0) + parseInt(stats.emails_sent || 0) ||
          0,
        unique_replies:
          parseInt(acc.unique_replies || 0) +
            parseInt(stats.unique_replies_per_contact || 0) || 0,
        bounced: parseInt(acc.bounced || 0) + parseInt(stats.bounced || 0) || 0,
        interested:
          parseInt(acc.interested || 0) + parseInt(stats.interested || 0) || 0,
        total_leads_contacted:
          parseInt(acc.total_leads_contacted || 0) +
            parseInt(stats.total_leads_contacted || 0) || 0,
        opened: parseInt(acc.opened || 0) + parseInt(stats.opened || 0) || 0,
        unique_opened:
          parseInt(acc.unique_opened || 0) +
            parseInt(stats.unique_opened || 0) || 0,
      };
    },
    {
      emails_sent: 0,
      opened: 0,
      unique_replies: 0,
      bounced: 0,
      interested: 0,
      total_leads_contacted: 0,
      unique_opened: 0,
    }
  );

  return {
    maxDailyCapacity,
    scheduledEmailsCount,
    remainingCapacity: maxDailyCapacity - scheduledEmailsCount,
    monthlyStats,
    aggregatedStats,
  };
};

const getWorkspaceBasicData = async (workspaceName, apiKey) => {
  try {
    const campaigns = await getBasicCampaignData(apiKey);

    return {
      workspaceName,
      campaigns: campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
      })),
    };
  } catch (error) {
    console.error(
      `Error fetching basic data for workspace ${workspaceName}:`,
      error
    );
    throw error;
  }
};

const getWorkspaceDetailedStats = async (workspaceName, apiKey) => {
  try {
    const campaigns = await getBasicCampaignData(apiKey);

    const blackListedDomains = await getBlackListedDomains(apiKey);

    const campaignsWithDetails = await Promise.all(
      campaigns.map(async (campaign) => {
        try {
          const details = await getCampaignDetails(campaign.id, apiKey);
          return {
            ...campaign,
            ...details,
          };
        } catch (error) {
          console.error(
            `Error fetching details for campaign ${campaign.id}:`,
            error
          );
          return {
            ...campaign,
            maxDailyCapacity: 0,
            scheduledEmailsCount: 0,
            remainingCapacity: 0,
            monthlyStats: [],
            aggregatedStats: {
              emails_sent: 0,
              unique_replies: 0,
              bounced: 0,
              interested: 0,
              total_leads_contacted: 0,
              opened: 0,
              unique_opened: 0,
            },
          };
        }
      })
    );

    const totalMaxCapacity = campaignsWithDetails.reduce(
      (sum, campaign) => sum + (campaign.maxDailyCapacity || 0),
      0
    );
    const totalScheduled = campaignsWithDetails.reduce(
      (sum, campaign) => sum + (campaign.scheduledEmailsCount || 0),
      0
    );

    const allMonths = new Map();
    campaignsWithDetails.forEach((campaign) => {
      campaign.monthlyStats.forEach((monthData) => {
        const key = `${monthData.year}-${monthData.month}`;
        if (!allMonths.has(key)) {
          allMonths.set(key, {
            year: monthData.year,
            month: monthData.month,
            stats: {
              emails_sent: 0,
              unique_replies: 0,
              bounced: 0,
              interested: 0,
              total_leads_contacted: 0,
              opened: 0,
              unique_opened: 0,
            },
          });
        }
      });
    });

    campaignsWithDetails.forEach((campaign) => {
      campaign.monthlyStats.forEach((monthData) => {
        const key = `${monthData.year}-${monthData.month}`;
        const monthStats = allMonths.get(key);
        if (monthStats && monthData.stats) {
          monthStats.stats.emails_sent += parseInt(
            monthData.stats.emails_sent || 0
          );
          monthStats.stats.unique_replies += parseInt(
            monthData.stats.unique_replies_per_contact || 0
          );
          monthStats.stats.bounced += parseInt(monthData.stats.bounced || 0);
          monthStats.stats.interested += parseInt(
            monthData.stats.interested || 0
          );
          monthStats.stats.total_leads_contacted += parseInt(
            monthData.stats.total_leads_contacted || 0
          );
          monthStats.stats.opened += parseInt(monthData.stats.opened || 0);
          monthStats.stats.unique_opened += parseInt(
            monthData.stats.unique_opened || 0
          );
        }
      });
    });

    const monthlyStats = Array.from(allMonths.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    const aggregatedStats = monthlyStats.reduce(
      (acc, monthData) => {
        const stats = monthData.stats;
        return {
          emails_sent: acc.emails_sent + stats.emails_sent,
          unique_replies: acc.unique_replies + stats.unique_replies,
          bounced: acc.bounced + stats.bounced,
          interested: acc.interested + stats.interested,
          total_leads_contacted:
            acc.total_leads_contacted + stats.total_leads_contacted,
          opened: acc.opened + stats.opened,
          unique_opened: acc.unique_opened + stats.unique_opened,
        };
      },
      {
        emails_sent: 0,
        unique_replies: 0,
        bounced: 0,
        interested: 0,
        total_leads_contacted: 0,
        opened: 0,
        unique_opened: 0,
      }
    );

    aggregatedStats.reply_percentage =
      aggregatedStats.total_leads_contacted > 0
        ? (
            (aggregatedStats.unique_replies /
              aggregatedStats.total_leads_contacted) *
            100
          ).toFixed(2)
        : "0.00";
    aggregatedStats.bounce_percentage =
      aggregatedStats.emails_sent > 0
        ? (
            (aggregatedStats.bounced / aggregatedStats.emails_sent) *
            100
          ).toFixed(2)
        : "0.00";

    return {
      workspaceName,
      totalMaxCapacity,
      totalScheduled,
      campaigns: campaignsWithDetails,
      monthlyStats,
      stats: aggregatedStats,
      blackListedDomains: blackListedDomains,
    };
  } catch (error) {
    console.error(
      `Error fetching detailed stats for workspace ${workspaceName}:`,
      error
    );
    throw error;
  }
};

const getAllWorkspacesBasicData = async () => {
  try {
    const workspaceData = await Promise.all(
      Object.entries(workspaces).map(([name, apiKey]) =>
        getWorkspaceBasicData(name, apiKey)
      )
    );

    return {
      data: workspaceData.map((workspace) => ({
        workspaceName: workspace.workspaceName,
        campaigns: workspace.campaigns,
      })),
    };
  } catch (error) {
    console.error("Error fetching workspaces basic data:", error);
    throw error;
  }
};

const getAllWorkspaceReplyRatesByProvider = async () => {
  try {
    const workspaceStats = await Promise.all(
      Object.entries(workspaces).map(async ([name, apiKey]) => {
        try {
          const stats = await getReplyRatesByProvider(name, apiKey);
          return {
            workspaceName: name,
            data: stats.data || [],
          };
        } catch (error) {
          console.error(
            `Error fetching reply rates for workspace ${name}:`,
            error
          );
          return {
            workspaceName: name,
            data: [],
          };
        }
      })
    );

    return {
      data: workspaceStats,
    };
  } catch (error) {
    console.error("Error fetching workspaces reply rates by provider:", error);
    return {
      data: [],
    };
  }
};

const getAllWorkspacesDetailedStats = async () => {
  try {
    const workspaceStats = await Promise.all(
      Object.entries(workspaces).map(([name, apiKey]) =>
        getWorkspaceDetailedStats(name, apiKey)
      )
    );

    const aggregateStats = workspaceStats.reduce(
      (acc, workspace) => {
        const stats = workspace.stats;
        return {
          totalEmailsSent: acc.totalEmailsSent + (stats.emails_sent || 0),
          totalReplies: acc.totalReplies + (stats.unique_replies || 0),
          totalBounced: acc.totalBounced + (stats.bounced || 0),
          totalScheduled: acc.totalScheduled + (workspace.totalScheduled || 0),
          totalMaxCapacity:
            acc.totalMaxCapacity + (workspace.totalMaxCapacity || 0),
          totalInterested: acc.totalInterested + (stats.interested || 0),
          total_leads_contacted:
            acc.total_leads_contacted + (stats.total_leads_contacted || 0),
          totalOpened: acc.totalOpened + (stats.opened || 0),
        };
      },
      {
        totalEmailsSent: 0,
        totalReplies: 0,
        totalBounced: 0,
        totalScheduled: 0,
        totalMaxCapacity: 0,
        totalInterested: 0,
        total_leads_contacted: 0,
        totalOpened: 0,
      }
    );

    const aggregatePercentages = {
      replyRate:
        aggregateStats.totalEmailsSent > 0
          ? (
              (aggregateStats.totalReplies / aggregateStats.totalEmailsSent) *
              100
            ).toFixed(2)
          : "0.00",
      bounceRate:
        aggregateStats.totalEmailsSent > 0
          ? (
              (aggregateStats.totalBounced / aggregateStats.totalEmailsSent) *
              100
            ).toFixed(2)
          : "0.00",
    };

    return {
      aggregateStats: {
        monthlyMetrics: {
          emailsSent: aggregateStats.totalEmailsSent,
          replies: aggregateStats.totalReplies,
          bounces: aggregateStats.totalBounced,
        },
        rates: {
          replyRate: aggregatePercentages.replyRate,
          bounceRate: aggregatePercentages.bounceRate,
        },
      },
      data: workspaceStats.map((workspace) => {
        const capacityRatio =
          workspace.totalMaxCapacity > 0
            ? (workspace.totalScheduled / workspace.totalMaxCapacity) * 100
            : 0;

        const hasLowCapacityWarning = capacityRatio < 50;

        return {
          workspaceName: workspace.workspaceName,
          totalScheduled: workspace.totalScheduled,
          totalMaxCapacity: workspace.totalMaxCapacity,
          capacityRatio: capacityRatio.toFixed(2),
          hasLowCapacityWarning,
          monthlyStats: workspace.monthlyStats,
          blackListedDomains: workspace.blackListedDomains,
          stats: {
            emailsSent: workspace.stats.emails_sent,
            total_leads_contacted: workspace.stats.total_leads_contacted,
            opened: {
              count: workspace.stats.opened,
              percentage: workspace.stats.opened_percentage,
            },
            replies: {
              count: workspace.stats.unique_replies,
              percentage: workspace.stats.reply_percentage,
            },
            bounced: {
              count: workspace.stats.bounced,
              percentage: workspace.stats.bounce_percentage,
            },
            interested: {
              count: workspace.stats.interested,
              percentage: workspace.stats.interested_percentage,
            },
          },
        };
      }),
    };
  } catch (error) {
    console.error("Error fetching workspaces detailed stats:", error);
    throw error;
  }
};

const calculateMaxDailyCapacity = (senderEmails) => {
  if (!Array.isArray(senderEmails)) return 0;

  const totalCapacity = senderEmails.reduce((total, senderEmail) => {
    const dailyLimit = parseInt(senderEmail.daily_limit) || 0;
    return total + dailyLimit;
  }, 0);

  return totalCapacity;
};

const getEmailProvider = (email) => {
  const domain = email.split("@")[1];

  return new Promise((resolve, reject) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err) {
        console.error(`Error resolving MX records for domain ${domain}:`, err);
        resolve("Unknown");
        return;
      }

      if (addresses && addresses.length > 0) {
        const provider = addresses[0].exchange;
        if (provider.includes("google")) {
          resolve("Google");
        } else if (provider.includes("outlook")) {
          resolve("Outlook");
        } else {
          resolve("Enterprise");
        }
      } else {
        resolve("Unknown");
      }
    });
  });
};

const getSenderEmailsWithProvider = async (apiKey) => {
  const options = {
    method: "GET",
    url: `${apiUrl}/api/sender-emails`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  };

  try {
    const { data } = await axios.request(options);
    return data.data;
  } catch (error) {
    console.error("Error fetching sender emails:", error);
    throw error;
  }
};

const getSenderEmailDetails = async (senderEmailId, apiKey) => {
  const options = {
    method: "GET",
    url: `${apiUrl}/api/sender-emails/${senderEmailId}`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  };

  try {
    const { data } = await axios.request(options);
    return data.data;
  } catch (error) {
    console.error(
      `Error fetching sender email details for ${senderEmailId}:`,
      error
    );
    throw error;
  }
};

const getReplieEmailDatails = async (senderEmailId, apiKey) => {
  const options = {
    method: "GET",
    url: `${apiUrl}/api/sender-emails/${senderEmailId}/replies`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  };

  try {
    const { data } = await axios.request(options);
    return data.data;
  } catch (error) {
    console.error(
      `Error fetching reply email details for ${senderEmailId}:`,
      error
    );
    throw error;
  }
};

const getBlackListedDomains = async (apiKey) => {
  const options = {
    method: "GET",
    url: `${apiUrl}/api/blacklisted-domains`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  };

  try {
    const { data } = await axios.request(options);
    return data.data;
  } catch (error) {
    console.error("Error fetching blacklisted domains:", error);
    throw error;
  }
};

const getReplyRatesByProvider = async (workspaceName, apiKey) => {
  try {
    const senderEmails = await getSenderEmailsWithProvider(apiKey);
    const providerStats = new Map();

    for (const sender of senderEmails) {
      const [sendersDetails, repliesDetails] = await Promise.all([
        getSenderEmailDetails(sender.id, apiKey),
        getReplieEmailDatails(sender.id, apiKey),
      ]);

      const senderHost = await getEmailProvider(sendersDetails.email);

      if (!providerStats.has(senderHost)) {
        providerStats.set(senderHost, {
          totalSent: 0,
          replies: new Map(),
        });
      }

      const senderStats = providerStats.get(senderHost);
      senderStats.totalSent += sendersDetails.emails_sent_count || 0;

      for (const replyDetails of repliesDetails) {
        const replyHost = await getEmailProvider(
          replyDetails.from_email_address
        );

        if (!senderStats.replies.has(replyHost)) {
          senderStats.replies.set(replyHost, 0);
        }

        senderStats.replies.set(
          replyHost,
          senderStats.replies.get(replyHost) + 1
        );
      }
    }

    const results = [];
    for (const [senderHost, stats] of providerStats.entries()) {
      for (const [replyHost, replyCount] of stats.replies.entries()) {
        const replyRate =
          stats.totalSent > 0 ? (replyCount / stats.totalSent) * 100 : 0;

        results.push({
          providerCombination: `${senderHost} → ${replyHost}`,
          totalReplies: replyCount,
          totalSent: stats.totalSent,
          replyRate: replyRate.toFixed(2),
        });
      }
    }

    results.sort((a, b) =>
      a.providerCombination.localeCompare(b.providerCombination)
    );

    return {
      workspaceName,
      data: results,
    };
  } catch (error) {
    console.error("Error calculating reply rates by provider:", error);
    throw error;
  }
};

export {
  getAllWorkspacesBasicData,
  getAllWorkspacesDetailedStats,
  getAllWorkspaceReplyRatesByProvider,
};
