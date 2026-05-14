exports.handler = async (event) => {
  console.log("VIPPS FUNCTION STARTET");

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({
        error: "Method not allowed"
      })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const amount = Number(body.amount);
    const description =
      body.description || "Betaling NICO CARS AS";

    if (!amount || amount <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Ugyldig beløp"
        })
      };
    }

    const baseUrl =
      process.env.VIPPS_BASE_URL ||
      "https://api.vipps.no";

    const frontendUrl =
      process.env.FRONTEND_URL ||
      "https://nicocars.com";

    const required = [
      "VIPPS_CLIENT_ID",
      "VIPPS_CLIENT_SECRET",
      "VIPPS_SUBSCRIPTION_KEY",
      "VIPPS_MSN"
    ];

    for (const key of required) {
      if (!process.env[key]) {
        return {
          statusCode: 500,
          body: JSON.stringify({
            error: `Mangler environment variable: ${key}`
          })
        };
      }
    }

    console.log("Henter access token...");

    const tokenResponse = await fetch(
      `${baseUrl}/accesstoken/get`,
      {
        method: "POST",
        headers: {
          client_id: process.env.VIPPS_CLIENT_ID,
          client_secret:
            process.env.VIPPS_CLIENT_SECRET,
          "Ocp-Apim-Subscription-Key":
            process.env.VIPPS_SUBSCRIPTION_KEY,
          "Merchant-Serial-Number":
            process.env.VIPPS_MSN
        }
      }
    );

    const tokenData = await tokenResponse.json();

    if (
      !tokenResponse.ok ||
      !tokenData.access_token
    ) {
      console.error("TOKEN ERROR:", tokenData);

      return {
        statusCode: 500,
        body: JSON.stringify({
          error:
            "Kunne ikke hente Vipps access token",
          details: tokenData
        })
      };
    }

    console.log("Token OK");

    const reference = `NICO-${Date.now()}`;

    const paymentResponse = await fetch(
      `${baseUrl}/epayment/v1/payments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key":
            process.env.VIPPS_SUBSCRIPTION_KEY,
          "Merchant-Serial-Number":
            process.env.VIPPS_MSN,
          "Idempotency-Key": reference,
          "Vipps-System-Name": "NicoCars",
          "Vipps-System-Version": "1.0",
          "Vipps-System-Plugin-Name": "Netlify",
          "Vipps-System-Plugin-Version": "1.0"
        },
        body: JSON.stringify({
          amount: {
            currency: "NOK",
            value: Math.round(amount * 100)
          },

          paymentMethod: {
            type: "WALLET"
          },

          reference: reference,

          returnUrl: `${frontendUrl}/`,

          userFlow: "WEB_REDIRECT",

          paymentDescription: description
        })
      }
    );

    const paymentData =
      await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error(
        "PAYMENT ERROR:",
        paymentData
      );

      return {
        statusCode: 500,
        body: JSON.stringify({
          error:
            "Kunne ikke opprette Vipps betaling",
          details: paymentData
        })
      };
    }

    console.log("Betaling opprettet");

    return {
      statusCode: 200,
      body: JSON.stringify({
        redirectUrl:
          paymentData.redirectUrl ||
          paymentData.url
      })
    };

  } catch (error) {
    console.error("VIPPS ERROR:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};
