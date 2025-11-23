import axios from "axios";

export async function sendSms(to, message) {
  try {
    const response = await axios({
      method: "post",
      url: `${process.env.INFOBIP_BASE_URL}/sms/2/text/advanced`,
      headers: {
        Authorization: `App ${process.env.INFOBIP_API_KEY}`,
        "Content-Type": "application/json"
      },
      data: {
        messages: [
          {
            destinations: [{ to }],
            text: message
          }
        ]
      }
    });

    console.log("Infobip SMS response:", JSON.stringify(response.data, null, 2));
    return true;

  } catch (error) {
    console.error("Infobip SMS error:", error.response?.data || error.message);
    throw error;
  }
}