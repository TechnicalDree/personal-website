// 100 of the biggest tech companies, used for the neon signs on the skyline.
// Short uppercase brand names / tickers so they fit on the small building signs.
(function () {
  const TECH_COMPANIES = [
    'APPLE', 'NVIDIA', 'MICROSOFT', 'GOOGLE', 'AMAZON', 'META', 'TESLA', 'TSMC',
    'BROADCOM', 'ORACLE', 'SAMSUNG', 'ASML', 'ADOBE', 'SAP', 'AMD', 'NETFLIX',
    'CISCO', 'INTEL', 'IBM', 'QUALCOMM', 'TENCENT', 'SONY', 'INTUIT', 'UBER',
    'SHOPIFY', 'ARM', 'PALANTIR', 'SNOWFLAKE', 'DELL', 'ACCENTURE', 'BOOKING',
    'AIRBNB', 'PAYPAL', 'BLOCK', 'STRIPE', 'SPOTIFY', 'ZOOM', 'SNAP', 'PINTEREST',
    'DROPBOX', 'TWILIO', 'DATADOG', 'CLOUDFLARE', 'MONGODB', 'ATLASSIAN', 'WORKDAY',
    'AUTODESK', 'ANSYS', 'CADENCE', 'SYNOPSYS', 'MICRON', 'AMAT', 'KLA', 'MARVELL',
    'NXP', 'INFINEON', 'STMICRO', 'ALIBABA', 'BAIDU', 'MEITUAN', 'BYTEDANCE',
    'XIAOMI', 'HUAWEI', 'LENOVO', 'NINTENDO', 'PANASONIC', 'TOSHIBA', 'FUJITSU',
    'HITACHI', 'CANON', 'NOKIA', 'ERICSSON', 'SIEMENS', 'PHILIPS', 'VMWARE',
    'REDHAT', 'OKTA', 'CROWDSTR', 'PALOALTO', 'FORTINET', 'ZSCALER', 'SPLUNK',
    'UNITY', 'ROBLOX', 'EA', 'TAKETWO', 'OPENAI', 'ANTHROPIC', 'SERVICENOW',
    'SQUARE', 'LYFT', 'DOORDASH', 'COINBASE', 'ROKU', 'HUBSPOT', 'NETAPP', 'WDC',
    'SEAGATE', 'KEYENCE', 'SALESFORCE',
  ];

  function randomTechCompany() {
    return TECH_COMPANIES[(Math.random() * TECH_COMPANIES.length) | 0];
  }

  window.TECH_COMPANIES = TECH_COMPANIES;
  window.randomTechCompany = randomTechCompany;
})();
