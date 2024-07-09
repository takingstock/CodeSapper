const config = require('config');

const TRIAL_ACCOUNT = config.get('TRIAL_ACCOUNT');

const APPROVE_CUSTOMER_TEMPLATE = (payload) => {
    console.log("PAYLOAD", payload)
    const newMessage = `<!DOCTYPE html>
  <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
  
  <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <meta name="x-apple-disable-message-reformatting">
      <title></title>
      <style>
          table,
          td,
          div,
          h1,
          p {
              font-family: Arial, sans-serif;
          }
  
          @media screen and (max-width: 530px) {
              .col-lge {
                  max-width: 100% !important;
              }
          }
  
          @media screen and (min-width: 531px) {
              .col-sml {
                  max-width: 27% !important;
              }
  
              .col-lge {
                  max-width: 73% !important;
              }
          }
      </style>
  </head>
  
  <body style="margin:0;padding:0;word-spacing:normal;">
      <div role="article" aria-roledescription="email" lang="en"
          style="text-size-adjust:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background-color:white;">
          <table role="presentation" style="width:100%;border:none;border-spacing:0;">
              <tr>
                  <td>
                      <div style="position: relative;">
                          <?xml version="1.0" encoding="utf-8"?>
                          <!-- Generator: Adobe Illustrator 24.3.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                          <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                              xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="95" height="50"
                              viewBox="0 0 1920 1080" style="enable-background:new 0 0 1920 1080;" xml:space="preserve">
                              <style type="text/css">
                                  .st0 {
                                      fill: #111111;
                                  }
  
                                  .st1 {
                                      fill: #231F20;
                                  }
  
                                  .st2 {
                                      fill: #FFDE17;
                                  }
  
                                  .st3 {
                                      fill: #D6E541;
                                  }
  
                                  .st4 {
                                      fill: #00A14B;
                                  }
  
                                  .st5 {
                                      fill: none;
                                      stroke: #F7941D;
                                      stroke-width: 2;
                                      stroke-linecap: round;
                                      stroke-linejoin: round;
                                      stroke-miterlimit: 10;
                                  }
  
                                  .subheader {
                                      width: 100%;
                                      height: 100%;
                                      font-family: Tahoma;
                                      font-size: 15px;
                                      font-weight: normal;
                                      font-stretch: normal;
                                      font-style: normal;
                                      line-height: normal;
                                      letter-spacing: normal;
                                      text-align: left;
                                      color: white;
                                  }
  
  
                                  .st6 {
                                      fill: #F7941D;
                                  }
  
                                  .st7 {
                                      fill: #FFFFFF;
                                  }
  
                                  .st8 {
                                      fill: #DA1C5C;
                                  }
  
                                  .st9 {
                                      fill: #F4C914;
                                  }
                              </style>
                              <g>
                                  <circle class="st9" cx="372.1" cy="540" r="268.78" />
                                  <g>
                                      <path d="M365.01,654.1h-63.09c-8.67,0-16.36,5.56-19.08,13.79l-4.89,14.8c-2.72,8.23-10.41,13.79-19.08,13.79h-32.68
              c-13.95,0-23.66-13.87-18.88-26.98l80.06-219.63c2.89-7.93,10.44-13.21,18.88-13.21h55.14c8.45,0,16,5.29,18.89,13.24
              l79.75,219.63c4.76,13.11-4.95,26.96-18.89,26.96h-33.09c-8.67,0-16.36-5.56-19.08-13.79l-4.89-14.8
              C381.37,659.66,373.68,654.1,365.01,654.1z M352.66,572.37L352.66,572.37c-6.12-18.36-32.11-18.31-38.16,0.08l0,0
              c-4.28,13,5.41,26.38,19.09,26.38h0C347.31,598.82,357,585.38,352.66,572.37z" />
                                  </g>
                                  <g>
                                      <path d="M757.78,535.39c12.4,13.12,18.6,31.05,18.6,53.8v94.08c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45
              v-86.09c0-9.22-2.57-16.39-7.69-21.52c-5.13-5.12-12.1-7.68-20.9-7.68c-8.82,0-15.78,2.56-20.91,7.68
              c-5.13,5.13-7.68,12.3-7.68,21.52v86.09c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45v-86.09
              c0-9.22-2.51-16.39-7.53-21.52c-5.02-5.12-11.94-7.68-20.75-7.68c-9.02,0-16.09,2.56-21.21,7.68c-5.13,5.13-7.69,12.3-7.69,21.52
              v86.09c0,3.56-2.89,6.45-6.45,6.45H487.7c-3.56,0-6.45-2.89-6.45-6.45V523.7c0-3.56,2.89-6.45,6.45-6.45h47.36
              c3.56,0,6.45,2.89,6.45,6.45v0.26c0,5.5,6.33,8.33,10.62,4.91c3.08-2.46,6.46-4.63,10.13-6.54c8.5-4.4,18.29-6.61,29.36-6.61
              c12.71,0,24.03,2.77,33.97,8.3c7.45,4.15,13.72,9.57,18.82,16.26c2.41,3.16,7.27,3.24,9.83,0.19c5.31-6.32,11.7-11.65,19.16-15.99
              c10.04-5.84,21.11-8.76,33.2-8.76C728.32,515.71,745.38,522.28,757.78,535.39z" />
                                      <path
                                          d="M991.09,526.24L887.19,767.9c-1.02,2.37-3.35,3.9-5.92,3.9H830.1c-4.7,0-7.82-4.87-5.86-9.14l35.79-77.72
              c0.76-1.66,0.79-3.56,0.07-5.23l-65.73-153.47c-1.82-4.25,1.3-8.98,5.93-8.98h52.76c2.7,0,5.11,1.68,6.04,4.2l28.57,76.99
              c2.09,5.64,10.08,5.59,12.11-0.07l27.55-76.85c0.92-2.56,3.35-4.27,6.07-4.27h51.77C989.8,517.25,992.92,521.99,991.09,526.24z" />
                                      <path d="M1152.4,544.3c-1.98,0-3.91-0.88-5.08-2.48c-3.29-4.54-7.51-8.12-12.65-10.74c-6.05-3.07-13.17-4.61-21.37-4.61
              c-15.17,0-27.11,4.92-35.82,14.76c-8.71,9.84-13.06,23.06-13.06,39.66c0,18.65,4.66,32.85,13.99,42.58
              c9.32,9.74,22.9,14.6,40.73,14.6c16.81,0,29.8-6.05,38.94-18.15c3.24-4.29,0.29-10.44-5.09-10.44h-42.78
              c-3.56,0-6.45-2.89-6.45-6.45v-30.45c0-3.56,2.89-6.45,6.45-6.45h99.62c3.56,0,6.45,2.89,6.45,6.45v50.6
              c0,0.9-0.17,1.79-0.52,2.62c-4.7,11.01-11.44,21.35-20.23,31.03c-9.12,10.04-20.65,18.29-34.58,24.75
              c-13.94,6.46-29.82,9.68-47.65,9.68c-21.72,0-40.94-4.66-57.64-13.99c-16.71-9.32-29.62-22.33-38.74-39.04
              c-9.12-16.7-13.68-35.81-13.68-57.33c0-21.31,4.56-40.32,13.68-57.03c9.12-16.7,21.98-29.71,38.58-39.04
              c16.6-9.32,35.76-13.99,57.49-13.99c27.26,0,49.8,6.56,67.63,19.67c15.65,11.52,26.09,26.75,31.32,45.69
              c1.13,4.08-2.02,8.11-6.25,8.11H1152.4z" />
                                      <path d="M1411.96,597.33c7.48,9.74,11.22,20.86,11.22,33.36c0,18.45-6.35,32.89-19.06,43.35c-12.71,10.45-30.54,15.68-53.49,15.68
              h-100.84c-3.56,0-6.45-2.89-6.45-6.45V479.43c0-3.56,2.89-6.45,6.45-6.45h97.46c22.13,0,39.5,4.92,52.11,14.76
              c12.6,9.84,18.91,23.67,18.91,41.5c0,12.71-3.33,23.32-9.99,31.82c-3.64,4.64-7.93,8.48-12.88,11.5c-4.1,2.51-3.95,8.72,0.3,10.98
              C1402.06,586.9,1407.48,591.5,1411.96,597.33z M1303.6,552.61c0,3.56,2.89,6.45,6.45,6.45h23.99c15.16,0,22.75-6.25,22.75-18.75
              c0-12.91-7.59-19.37-22.75-19.37h-23.99c-3.56,0-6.45,2.89-6.45,6.45V552.61z M1361.39,622.08c0-6.56-2-11.58-5.99-15.06
              c-4-3.48-9.69-5.23-17.06-5.23h-28.29c-3.56,0-6.45,2.89-6.45,6.45v26.46c0,3.56,2.89,6.45,6.45,6.45h28.6
              C1353.81,641.14,1361.39,634.79,1361.39,622.08z" />
                                      <path d="M1453.15,683.41c-6.46-5.84-9.68-13.27-9.68-22.29c0-9.01,3.23-16.49,9.68-22.44c6.46-5.94,15.01-8.91,25.67-8.91
              c10.45,0,18.9,2.97,25.36,8.91c6.46,5.95,9.68,13.43,9.68,22.44c0,8.82-3.23,16.19-9.68,22.14c-6.46,5.95-14.91,8.91-25.36,8.91
              C1468.16,692.17,1459.61,689.25,1453.15,683.41z" />
                                      <path d="M1542,556.6c6.45-13.32,15.26-23.57,26.44-30.74c11.17-7.17,23.62-10.76,37.35-10.76c11.88,0,22.13,2.36,30.74,7.07
              c3.39,1.86,6.48,3.97,9.26,6.33c4.24,3.6,10.72,0.76,10.72-4.8v0c0-3.56,2.89-6.45,6.45-6.45h47.36c3.56,0,6.45,2.89,6.45,6.45
              v159.57c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45v-0.05c0-5.55-6.46-8.4-10.7-4.82
              c-2.83,2.39-5.98,4.52-9.44,6.4c-8.71,4.72-18.91,7.07-30.59,7.07c-13.74,0-26.18-3.58-37.35-10.76
              c-11.17-7.17-19.98-17.47-26.44-30.9c-6.46-13.42-9.69-29.05-9.69-46.88C1532.31,585.5,1535.54,569.93,1542,556.6z M1647.44,577.2
              c-6.05-6.35-13.48-9.53-22.29-9.53c-9.02,0-16.5,3.13-22.44,9.38c-5.95,6.25-8.91,15.02-8.91,26.28c0,11.07,2.97,19.83,8.91,26.29
              c7.56,8.21,17.6,11.2,30.14,8.97c0.47-0.08,0.96-0.22,1.41-0.39c14.81-5.57,22.25-17.2,22.25-34.87
              C1656.51,592.26,1653.49,583.55,1647.44,577.2z" />
                                      <path class="st9" d="M1755.96,492.5c-6.46-5.84-9.69-13.17-9.69-21.98c0-9.02,3.23-16.5,9.69-22.44
              c6.45-5.94,15.01-8.91,25.67-8.91c10.45,0,18.91,2.97,25.36,8.91c6.45,5.95,9.68,13.43,9.68,22.44c0,8.81-3.23,16.14-9.68,21.98
              c-6.46,5.84-14.91,8.76-25.36,8.76C1770.97,501.26,1762.42,498.35,1755.96,492.5z" />
                                      <path d="M1811.45,523.7v159.57c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45V523.7c0-3.56,2.89-6.45,6.45-6.45
              H1805C1808.56,517.25,1811.45,520.14,1811.45,523.7z" />
                                  </g>
                              </g>
                          </svg>
                          <div style="float: right;
  width: 95px;
  height: 50px;
  position: absolute;
  top: 25%;
  right: 2%;">
                              <img style="width: 100%"
                                  src='https://amygb-web-static.s3.ap-south-1.amazonaws.com/visionLogo.png' />
  
                          </div>
                      </div>
  
                  </td>
  
              </tr>
              <tr>
                  <td align="center" style="padding:0;">
                      <table role="presentation"
                          style="width:100%;border:none;border-spacing:0;text-align:left;font-family:Arial,sans-serif;font-size:16px;line-height:22px;">
                          <tr>
                              <td
                                  style="padding:50px 30px 50px 30px;text-align:center;font-size:24px;font-weight:bold;background-color: black;">
                                  <div class="hello" style="font-family: Tahoma;
                  font-weight: 800;
                  font-stretch: normal;
                  font-size:26px;
                  font-style: normal;
                  line-height: normal;
                  letter-spacing: normal;
                  text-align: left;
                  font-family: Tahoma;
                  color: white;">
                                      <span class="text-style-1" style="color: white;">Hello </span><span
                                          style="color: #f4c914;">${payload.firstName || payload.lastName},</span>
                                      <br />
                                      <span class="subheader">
                                          We’re excited you’ve joined us!
                                      </span>
                                  </div>
                                  <div class="subheader" style="width: 100%;
          height: 100%;
          font-family: Tahoma;
          font-weight: normal;
          font-stretch: normal;
          font-style: normal;
          line-height: normal;
          letter-spacing: normal;
          text-align: left;
          margin-top: 1vh;
          color: white;">
                                  </div>
                              </td>
                          </tr>
                          <tr>
                              <td style="padding:30px;background-color:#f2f2f2;">
                                  <h1
                                      style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: normal;">
                                      Here are your credentials for the ${payload.expiryInDays} day free trial to get a sneak peek
                                      into VisionERA.
                                      <br />
                                      <span class="url" style="margin: 30px 183px 50px 0;
              font-family: Tahoma;
              font-size: 15px;
              font-weight: normal;
              font-stretch: normal;
              font-style: normal;
              line-height: 1.67;
              letter-spacing: normal;
              text-align: left;
              color: #006cff;">
                                          URL: <a href="${payload.url}" target="_blank">
                                              <span style="color: 006cff !important;">${payload.url}</span>
                                          </a>
                                      </span>
                                      <h1
                                          style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: 600;">
  
                                          Email : ${payload.email}</h1>
                                      <h1
                                          style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: 600;">
  
                                          Password : ${payload.password}</h1>
                                  </h1>
  
  
                              </td>
                          </tr>
  
                          <tr>
                              <td style="padding:35px 30px 11px 30px;font-size:0;background-color:#ffffff;">
  
                                  <div class="col-lge"
                                      style="display:inline-block;width:100%;max-width:395px;vertical-align:top;padding-bottom:20px;font-family:Arial,sans-serif;font-size:16px;line-height:22px;color:#5e5e5e;">
                                      <h1
                                          style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: normal;">
  
                                          In order to reap maximum benefits from your Visionera free trial, we recommend a
                                          <a href="http://scheduler.amygb.ai/" target="_blank">quick call</a> with our
                                          Product
                                          experts to understand your specific requirements and guide you on best practices
                                          designed to help you
                                          achieve your goals faster.
                                      </h1>
                                      <br />
                                      <div
                                          style="margin-top:0;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: 500;color: black;">
                                          Regards,
                                      </div>
                                      <div
                                          style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: 500;">
                                          Team VisionERA
                                      </div>
                                      <a href="${TRIAL_ACCOUNT.LINK}" target="_blank">${TRIAL_ACCOUNT.LINK}</a> 
                                      <br/>
                                      <br/>
                                      <p
                                          style="border-bottom: solid 1px lightGray;padding-bottom: 20px;margin-bottom: 20px;">
                                          <a href='https://www.facebook.com/amygb.agb/' target="_blank"
                                              style="text-decoration: none">
                                              <?xml version="1.0" encoding="iso-8859-1"?>
                                              <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                                              <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                                  xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                  viewBox="0 0 310 310" style="enable-background:new 0 0 310 310;"
                                                  xml:space="preserve" width="20" height="20" fill='#868686'>
                                                  <g id="XMLID_834_">
                                                      <path id="XMLID_835_" d="M81.703,165.106h33.981V305c0,2.762,2.238,5,5,5h57.616c2.762,0,5-2.238,5-5V165.765h39.064
          c2.54,0,4.677-1.906,4.967-4.429l5.933-51.502c0.163-1.417-0.286-2.836-1.234-3.899c-0.949-1.064-2.307-1.673-3.732-1.673h-44.996
          V71.978c0-9.732,5.24-14.667,15.576-14.667c1.473,0,29.42,0,29.42,0c2.762,0,5-2.239,5-5V5.037c0-2.762-2.238-5-5-5h-40.545
          C187.467,0.023,186.832,0,185.896,0c-7.035,0-31.488,1.381-50.804,19.151c-21.402,19.692-18.427,43.27-17.716,47.358v37.752H81.703
          c-2.762,0-5,2.238-5,5v50.844C76.703,162.867,78.941,165.106,81.703,165.106z" />
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                              </svg>
                                          </a>&nbsp;&nbsp;&nbsp;&nbsp;
                                          <a href='https://twitter.com/AmyGB_ai' target="_blank"
                                              style="text-decoration: none">
                                              <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                                              <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                                  xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                  viewBox="0 0 310 310" style="enable-background:new 0 0 310 310;"
                                                  xml:space="preserve" width='20' height='20' fill='#868686'>
                                                  <g id="XMLID_826_">
                                                      <path id="XMLID_827_" d="M302.973,57.388c-4.87,2.16-9.877,3.983-14.993,5.463c6.057-6.85,10.675-14.91,13.494-23.73
          c0.632-1.977-0.023-4.141-1.648-5.434c-1.623-1.294-3.878-1.449-5.665-0.39c-10.865,6.444-22.587,11.075-34.878,13.783
          c-12.381-12.098-29.197-18.983-46.581-18.983c-36.695,0-66.549,29.853-66.549,66.547c0,2.89,0.183,5.764,0.545,8.598
          C101.163,99.244,58.83,76.863,29.76,41.204c-1.036-1.271-2.632-1.956-4.266-1.825c-1.635,0.128-3.104,1.05-3.93,2.467
          c-5.896,10.117-9.013,21.688-9.013,33.461c0,16.035,5.725,31.249,15.838,43.137c-3.075-1.065-6.059-2.396-8.907-3.977
          c-1.529-0.851-3.395-0.838-4.914,0.033c-1.52,0.871-2.473,2.473-2.513,4.224c-0.007,0.295-0.007,0.59-0.007,0.889
          c0,23.935,12.882,45.484,32.577,57.229c-1.692-0.169-3.383-0.414-5.063-0.735c-1.732-0.331-3.513,0.276-4.681,1.597
          c-1.17,1.32-1.557,3.16-1.018,4.84c7.29,22.76,26.059,39.501,48.749,44.605c-18.819,11.787-40.34,17.961-62.932,17.961
          c-4.714,0-9.455-0.277-14.095-0.826c-2.305-0.274-4.509,1.087-5.294,3.279c-0.785,2.193,0.047,4.638,2.008,5.895
          c29.023,18.609,62.582,28.445,97.047,28.445c67.754,0,110.139-31.95,133.764-58.753c29.46-33.421,46.356-77.658,46.356-121.367
          c0-1.826-0.028-3.67-0.084-5.508c11.623-8.757,21.63-19.355,29.773-31.536c1.237-1.85,1.103-4.295-0.33-5.998
          C307.394,57.037,305.009,56.486,302.973,57.388z" />
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                              </svg>
                                          </a>&nbsp;&nbsp;&nbsp;&nbsp;
                                          <a href='https://www.linkedin.com/company/amygb.ai/' target="_blank">
  
                                              <?xml version="1.0" encoding="iso-8859-1"?>
                                              <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                                              <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                                  xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                  viewBox="0 0 310 310" style="enable-background:new 0 0 310 310;"
                                                  xml:space="preserve" width='20' height='20' fill='#868686'>
                                                  <g id="XMLID_801_">
                                                      <path id="XMLID_802_" d="M72.16,99.73H9.927c-2.762,0-5,2.239-5,5v199.928c0,2.762,2.238,5,5,5H72.16c2.762,0,5-2.238,5-5V104.73
          C77.16,101.969,74.922,99.73,72.16,99.73z" />
                                                      <path id="XMLID_803_" d="M41.066,0.341C18.422,0.341,0,18.743,0,41.362C0,63.991,18.422,82.4,41.066,82.4
          c22.626,0,41.033-18.41,41.033-41.038C82.1,18.743,63.692,0.341,41.066,0.341z" />
                                                      <path id="XMLID_804_" d="M230.454,94.761c-24.995,0-43.472,10.745-54.679,22.954V104.73c0-2.761-2.238-5-5-5h-59.599
          c-2.762,0-5,2.239-5,5v199.928c0,2.762,2.238,5,5,5h62.097c2.762,0,5-2.238,5-5v-98.918c0-33.333,9.054-46.319,32.29-46.319
          c25.306,0,27.317,20.818,27.317,48.034v97.204c0,2.762,2.238,5,5,5H305c2.762,0,5-2.238,5-5V194.995
          C310,145.43,300.549,94.761,230.454,94.761z" />
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                              </svg>
                                          </a>
  
  
  
  
                                      </p>
                                      <p>
                                          <span style="font-size:13px"><a href="https://www.amygb.ai/contact/"
                                                  target="_blank" style="color:#868686;text-decoration:underline;">Contact
                                                  Us</a></span>&nbsp;&nbsp;&nbsp;&nbsp;
                                          <span style="font-size:13px"><a href="https://www.amygb.ai/privacy-policy/"
                                                  target="_blank" style="color:#868686;text-decoration:underline;">Privacy
                                                  Policy</a></span>
  
                                      </p>
                                  </div>
                              </td>
                          </tr>
                      </table>
                  </td>
              </tr>
              <tr style="background-color:#1a1a1a; color: white;">
                  <td style="font-size: 12px;padding:10px 30px; ">© 2022 AmyGB </td>
              </tr>
          </table>
      </div>
  </body>
  
  </html>`
    return newMessage;
};

const SIGNUP_TEMPLATE = () => {
    const newMessage = `<!DOCTYPE html>
  <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
  
  <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <meta name="x-apple-disable-message-reformatting">
      <title></title>
      <style>
          table,
          td,
          div,
          h1,
          p {
              font-family: Arial, sans-serif;
          }
  
          @media screen and (max-width: 530px) {
              .col-lge {
                  max-width: 100% !important;
              }
          }
  
          @media screen and (min-width: 531px) {
              .col-sml {
                  max-width: 27% !important;
              }
  
              .col-lge {
                  max-width: 73% !important;
              }
          }
      </style>
  </head>
  
  <body style="margin:0;padding:0;word-spacing:normal;">
      <div role="article" aria-roledescription="email" lang="en"
          style="text-size-adjust:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background-color:white;">
          <table role="presentation" style="width:100%;border:none;border-spacing:0;">
              <tr>
                  <td>
                      <div style="position: relative;">
                          <?xml version="1.0" encoding="utf-8"?>
                          <!-- Generator: Adobe Illustrator 24.3.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                          <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                              xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="95" height="50"
                              viewBox="0 0 1920 1080" style="enable-background:new 0 0 1920 1080;" xml:space="preserve">
                              <style type="text/css">
                                  .st0 {
                                      fill: #111111;
                                  }
  
                                  .st1 {
                                      fill: #231F20;
                                  }
  
                                  .st2 {
                                      fill: #FFDE17;
                                  }
  
                                  .st3 {
                                      fill: #D6E541;
                                  }
  
                                  .st4 {
                                      fill: #00A14B;
                                  }
  
                                  .st5 {
                                      fill: none;
                                      stroke: #F7941D;
                                      stroke-width: 2;
                                      stroke-linecap: round;
                                      stroke-linejoin: round;
                                      stroke-miterlimit: 10;
                                  }
  
                                  .st6 {
                                      fill: #F7941D;
                                  }
  
                                  .st7 {
                                      fill: #FFFFFF;
                                  }
  
                                  .st8 {
                                      fill: #DA1C5C;
                                  }
  
                                  .st9 {
                                      fill: #F4C914;
                                  }
                              </style>
                              <g>
                                  <circle class="st9" cx="372.1" cy="540" r="268.78" />
                                  <g>
                                      <path d="M365.01,654.1h-63.09c-8.67,0-16.36,5.56-19.08,13.79l-4.89,14.8c-2.72,8.23-10.41,13.79-19.08,13.79h-32.68
              c-13.95,0-23.66-13.87-18.88-26.98l80.06-219.63c2.89-7.93,10.44-13.21,18.88-13.21h55.14c8.45,0,16,5.29,18.89,13.24
              l79.75,219.63c4.76,13.11-4.95,26.96-18.89,26.96h-33.09c-8.67,0-16.36-5.56-19.08-13.79l-4.89-14.8
              C381.37,659.66,373.68,654.1,365.01,654.1z M352.66,572.37L352.66,572.37c-6.12-18.36-32.11-18.31-38.16,0.08l0,0
              c-4.28,13,5.41,26.38,19.09,26.38h0C347.31,598.82,357,585.38,352.66,572.37z" />
                                  </g>
                                  <g>
                                      <path d="M757.78,535.39c12.4,13.12,18.6,31.05,18.6,53.8v94.08c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45
              v-86.09c0-9.22-2.57-16.39-7.69-21.52c-5.13-5.12-12.1-7.68-20.9-7.68c-8.82,0-15.78,2.56-20.91,7.68
              c-5.13,5.13-7.68,12.3-7.68,21.52v86.09c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45v-86.09
              c0-9.22-2.51-16.39-7.53-21.52c-5.02-5.12-11.94-7.68-20.75-7.68c-9.02,0-16.09,2.56-21.21,7.68c-5.13,5.13-7.69,12.3-7.69,21.52
              v86.09c0,3.56-2.89,6.45-6.45,6.45H487.7c-3.56,0-6.45-2.89-6.45-6.45V523.7c0-3.56,2.89-6.45,6.45-6.45h47.36
              c3.56,0,6.45,2.89,6.45,6.45v0.26c0,5.5,6.33,8.33,10.62,4.91c3.08-2.46,6.46-4.63,10.13-6.54c8.5-4.4,18.29-6.61,29.36-6.61
              c12.71,0,24.03,2.77,33.97,8.3c7.45,4.15,13.72,9.57,18.82,16.26c2.41,3.16,7.27,3.24,9.83,0.19c5.31-6.32,11.7-11.65,19.16-15.99
              c10.04-5.84,21.11-8.76,33.2-8.76C728.32,515.71,745.38,522.28,757.78,535.39z" />
                                      <path
                                          d="M991.09,526.24L887.19,767.9c-1.02,2.37-3.35,3.9-5.92,3.9H830.1c-4.7,0-7.82-4.87-5.86-9.14l35.79-77.72
              c0.76-1.66,0.79-3.56,0.07-5.23l-65.73-153.47c-1.82-4.25,1.3-8.98,5.93-8.98h52.76c2.7,0,5.11,1.68,6.04,4.2l28.57,76.99
              c2.09,5.64,10.08,5.59,12.11-0.07l27.55-76.85c0.92-2.56,3.35-4.27,6.07-4.27h51.77C989.8,517.25,992.92,521.99,991.09,526.24z" />
                                      <path d="M1152.4,544.3c-1.98,0-3.91-0.88-5.08-2.48c-3.29-4.54-7.51-8.12-12.65-10.74c-6.05-3.07-13.17-4.61-21.37-4.61
              c-15.17,0-27.11,4.92-35.82,14.76c-8.71,9.84-13.06,23.06-13.06,39.66c0,18.65,4.66,32.85,13.99,42.58
              c9.32,9.74,22.9,14.6,40.73,14.6c16.81,0,29.8-6.05,38.94-18.15c3.24-4.29,0.29-10.44-5.09-10.44h-42.78
              c-3.56,0-6.45-2.89-6.45-6.45v-30.45c0-3.56,2.89-6.45,6.45-6.45h99.62c3.56,0,6.45,2.89,6.45,6.45v50.6
              c0,0.9-0.17,1.79-0.52,2.62c-4.7,11.01-11.44,21.35-20.23,31.03c-9.12,10.04-20.65,18.29-34.58,24.75
              c-13.94,6.46-29.82,9.68-47.65,9.68c-21.72,0-40.94-4.66-57.64-13.99c-16.71-9.32-29.62-22.33-38.74-39.04
              c-9.12-16.7-13.68-35.81-13.68-57.33c0-21.31,4.56-40.32,13.68-57.03c9.12-16.7,21.98-29.71,38.58-39.04
              c16.6-9.32,35.76-13.99,57.49-13.99c27.26,0,49.8,6.56,67.63,19.67c15.65,11.52,26.09,26.75,31.32,45.69
              c1.13,4.08-2.02,8.11-6.25,8.11H1152.4z" />
                                      <path d="M1411.96,597.33c7.48,9.74,11.22,20.86,11.22,33.36c0,18.45-6.35,32.89-19.06,43.35c-12.71,10.45-30.54,15.68-53.49,15.68
              h-100.84c-3.56,0-6.45-2.89-6.45-6.45V479.43c0-3.56,2.89-6.45,6.45-6.45h97.46c22.13,0,39.5,4.92,52.11,14.76
              c12.6,9.84,18.91,23.67,18.91,41.5c0,12.71-3.33,23.32-9.99,31.82c-3.64,4.64-7.93,8.48-12.88,11.5c-4.1,2.51-3.95,8.72,0.3,10.98
              C1402.06,586.9,1407.48,591.5,1411.96,597.33z M1303.6,552.61c0,3.56,2.89,6.45,6.45,6.45h23.99c15.16,0,22.75-6.25,22.75-18.75
              c0-12.91-7.59-19.37-22.75-19.37h-23.99c-3.56,0-6.45,2.89-6.45,6.45V552.61z M1361.39,622.08c0-6.56-2-11.58-5.99-15.06
              c-4-3.48-9.69-5.23-17.06-5.23h-28.29c-3.56,0-6.45,2.89-6.45,6.45v26.46c0,3.56,2.89,6.45,6.45,6.45h28.6
              C1353.81,641.14,1361.39,634.79,1361.39,622.08z" />
                                      <path d="M1453.15,683.41c-6.46-5.84-9.68-13.27-9.68-22.29c0-9.01,3.23-16.49,9.68-22.44c6.46-5.94,15.01-8.91,25.67-8.91
              c10.45,0,18.9,2.97,25.36,8.91c6.46,5.95,9.68,13.43,9.68,22.44c0,8.82-3.23,16.19-9.68,22.14c-6.46,5.95-14.91,8.91-25.36,8.91
              C1468.16,692.17,1459.61,689.25,1453.15,683.41z" />
                                      <path d="M1542,556.6c6.45-13.32,15.26-23.57,26.44-30.74c11.17-7.17,23.62-10.76,37.35-10.76c11.88,0,22.13,2.36,30.74,7.07
              c3.39,1.86,6.48,3.97,9.26,6.33c4.24,3.6,10.72,0.76,10.72-4.8v0c0-3.56,2.89-6.45,6.45-6.45h47.36c3.56,0,6.45,2.89,6.45,6.45
              v159.57c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45v-0.05c0-5.55-6.46-8.4-10.7-4.82
              c-2.83,2.39-5.98,4.52-9.44,6.4c-8.71,4.72-18.91,7.07-30.59,7.07c-13.74,0-26.18-3.58-37.35-10.76
              c-11.17-7.17-19.98-17.47-26.44-30.9c-6.46-13.42-9.69-29.05-9.69-46.88C1532.31,585.5,1535.54,569.93,1542,556.6z M1647.44,577.2
              c-6.05-6.35-13.48-9.53-22.29-9.53c-9.02,0-16.5,3.13-22.44,9.38c-5.95,6.25-8.91,15.02-8.91,26.28c0,11.07,2.97,19.83,8.91,26.29
              c7.56,8.21,17.6,11.2,30.14,8.97c0.47-0.08,0.96-0.22,1.41-0.39c14.81-5.57,22.25-17.2,22.25-34.87
              C1656.51,592.26,1653.49,583.55,1647.44,577.2z" />
                                      <path class="st9" d="M1755.96,492.5c-6.46-5.84-9.69-13.17-9.69-21.98c0-9.02,3.23-16.5,9.69-22.44
              c6.45-5.94,15.01-8.91,25.67-8.91c10.45,0,18.91,2.97,25.36,8.91c6.45,5.95,9.68,13.43,9.68,22.44c0,8.81-3.23,16.14-9.68,21.98
              c-6.46,5.84-14.91,8.76-25.36,8.76C1770.97,501.26,1762.42,498.35,1755.96,492.5z" />
                                      <path d="M1811.45,523.7v159.57c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45V523.7c0-3.56,2.89-6.45,6.45-6.45
              H1805C1808.56,517.25,1811.45,520.14,1811.45,523.7z" />
                                  </g>
                              </g>
                          </svg>
                          <div style="float: right;
  width: 95px;
  height: 50px;
  position: absolute;
  top: 25%;
  right: 2%;">
                              <img style="width: 100%"
                                  src='https://amygb-web-static.s3.ap-south-1.amazonaws.com/visionLogo.png' />
  
                          </div>
                      </div>
  
                  </td>
  
              </tr>
              <tr>
                  <td align="center" style="padding:0;">
                      <table role="presentation"
                          style="width:100%;border:none;border-spacing:0;text-align:left;font-family:Arial,sans-serif;font-size:16px;line-height:22px;">
                          <tr>
                              <td
                                  style="padding:50px 30px 50px 30px;text-align:center;font-size:24px;font-weight:bold;background-color: black;">
                                  <div class="hello" style="font-family: Tahoma;
                  font-weight: 800;
                  font-stretch: normal;
                  font-size:26px;
                  font-style: normal;
                  line-height: normal;
                  letter-spacing: normal;
                  text-align: left;
                  font-family: Tahoma;
                  color: white;">
                                      <span class="text-style-1" style="color: white;">Thank you for</span><br /><span
                                          style="color: #f4c914;">signing up!</span>
                                  </div>
                                  <div class="subheader" style="width: 100%;
          height: 100%;
          font-family: Tahoma;
          font-weight: normal;
          font-stretch: normal;
          font-style: normal;
          line-height: normal;
          letter-spacing: normal;
          text-align: left;
          margin-top: 1vh;
          color: white;">
                                  </div>
                              </td>
                          </tr>
                          <tr>
                              <td style="padding:30px;background-color:#f2f2f2;">
                                  <h1
                                      style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;">
                                      Hello
                                  </h1>
                                  <p style="margin-top:0;margin-bottom:12px;">
                                      Your Free Trial account will be activated within 24 hours. We will send you an email
                                      with your login details.
                                  </p>
  
  
                              </td>
                          </tr>
  
                          <tr>
                              <td style="padding:35px 30px 11px 30px;font-size:0;background-color:#ffffff;">
  
                                  <div class="col-lge"
                                      style="display:inline-block;width:100%;max-width:395px;vertical-align:top;padding-bottom:20px;font-family:Arial,sans-serif;font-size:16px;line-height:22px;color:#5e5e5e;">
                                      <p
                                          style="border-bottom: solid 1px lightGray;padding-bottom: 20px;margin-bottom: 20px;">
                                          <a href='https://www.facebook.com/amygb.agb/' target="_blank" style="text-decoration: none">
                                              <?xml version="1.0" encoding="iso-8859-1"?>
                                              <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                                              <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                                  xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                  viewBox="0 0 310 310" style="enable-background:new 0 0 310 310;"
                                                  xml:space="preserve" width="20" height="20" fill='#868686'>
                                                  <g id="XMLID_834_">
                                                      <path id="XMLID_835_" d="M81.703,165.106h33.981V305c0,2.762,2.238,5,5,5h57.616c2.762,0,5-2.238,5-5V165.765h39.064
          c2.54,0,4.677-1.906,4.967-4.429l5.933-51.502c0.163-1.417-0.286-2.836-1.234-3.899c-0.949-1.064-2.307-1.673-3.732-1.673h-44.996
          V71.978c0-9.732,5.24-14.667,15.576-14.667c1.473,0,29.42,0,29.42,0c2.762,0,5-2.239,5-5V5.037c0-2.762-2.238-5-5-5h-40.545
          C187.467,0.023,186.832,0,185.896,0c-7.035,0-31.488,1.381-50.804,19.151c-21.402,19.692-18.427,43.27-17.716,47.358v37.752H81.703
          c-2.762,0-5,2.238-5,5v50.844C76.703,162.867,78.941,165.106,81.703,165.106z" />
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                              </svg>
                                          </a>&nbsp;&nbsp;&nbsp;&nbsp;
                                          <a href='https://twitter.com/AmyGB_ai' target="_blank" style="text-decoration: none">
                                              <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                                              <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                                  xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                  viewBox="0 0 310 310" style="enable-background:new 0 0 310 310;"
                                                  xml:space="preserve" width='20' height='20' fill='#868686'>
                                                  <g id="XMLID_826_">
                                                      <path id="XMLID_827_" d="M302.973,57.388c-4.87,2.16-9.877,3.983-14.993,5.463c6.057-6.85,10.675-14.91,13.494-23.73
          c0.632-1.977-0.023-4.141-1.648-5.434c-1.623-1.294-3.878-1.449-5.665-0.39c-10.865,6.444-22.587,11.075-34.878,13.783
          c-12.381-12.098-29.197-18.983-46.581-18.983c-36.695,0-66.549,29.853-66.549,66.547c0,2.89,0.183,5.764,0.545,8.598
          C101.163,99.244,58.83,76.863,29.76,41.204c-1.036-1.271-2.632-1.956-4.266-1.825c-1.635,0.128-3.104,1.05-3.93,2.467
          c-5.896,10.117-9.013,21.688-9.013,33.461c0,16.035,5.725,31.249,15.838,43.137c-3.075-1.065-6.059-2.396-8.907-3.977
          c-1.529-0.851-3.395-0.838-4.914,0.033c-1.52,0.871-2.473,2.473-2.513,4.224c-0.007,0.295-0.007,0.59-0.007,0.889
          c0,23.935,12.882,45.484,32.577,57.229c-1.692-0.169-3.383-0.414-5.063-0.735c-1.732-0.331-3.513,0.276-4.681,1.597
          c-1.17,1.32-1.557,3.16-1.018,4.84c7.29,22.76,26.059,39.501,48.749,44.605c-18.819,11.787-40.34,17.961-62.932,17.961
          c-4.714,0-9.455-0.277-14.095-0.826c-2.305-0.274-4.509,1.087-5.294,3.279c-0.785,2.193,0.047,4.638,2.008,5.895
          c29.023,18.609,62.582,28.445,97.047,28.445c67.754,0,110.139-31.95,133.764-58.753c29.46-33.421,46.356-77.658,46.356-121.367
          c0-1.826-0.028-3.67-0.084-5.508c11.623-8.757,21.63-19.355,29.773-31.536c1.237-1.85,1.103-4.295-0.33-5.998
          C307.394,57.037,305.009,56.486,302.973,57.388z" />
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                              </svg>
                                          </a>&nbsp;&nbsp;&nbsp;&nbsp;
                                          <a href='https://www.linkedin.com/company/amygb.ai/' target="_blank">
  
                                              <?xml version="1.0" encoding="iso-8859-1"?>
                                              <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                                              <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                                  xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                  viewBox="0 0 310 310" style="enable-background:new 0 0 310 310;"
                                                  xml:space="preserve" width='20' height='20' fill='#868686'>
                                                  <g id="XMLID_801_">
                                                      <path id="XMLID_802_" d="M72.16,99.73H9.927c-2.762,0-5,2.239-5,5v199.928c0,2.762,2.238,5,5,5H72.16c2.762,0,5-2.238,5-5V104.73
          C77.16,101.969,74.922,99.73,72.16,99.73z" />
                                                      <path id="XMLID_803_" d="M41.066,0.341C18.422,0.341,0,18.743,0,41.362C0,63.991,18.422,82.4,41.066,82.4
          c22.626,0,41.033-18.41,41.033-41.038C82.1,18.743,63.692,0.341,41.066,0.341z" />
                                                      <path id="XMLID_804_" d="M230.454,94.761c-24.995,0-43.472,10.745-54.679,22.954V104.73c0-2.761-2.238-5-5-5h-59.599
          c-2.762,0-5,2.239-5,5v199.928c0,2.762,2.238,5,5,5h62.097c2.762,0,5-2.238,5-5v-98.918c0-33.333,9.054-46.319,32.29-46.319
          c25.306,0,27.317,20.818,27.317,48.034v97.204c0,2.762,2.238,5,5,5H305c2.762,0,5-2.238,5-5V194.995
          C310,145.43,300.549,94.761,230.454,94.761z" />
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                                  <g>
                                                  </g>
                                              </svg>
                                          </a>
  
  
  
  
                                      </p>
                                      <p>
                                          <span style="font-size:13px"><a href="https://www.amygb.ai/contact/"
                                                  target="_blank" style="color:#868686;text-decoration:underline;">Contact
                                                  Us</a></span>&nbsp;&nbsp;&nbsp;&nbsp;
                                          <span style="font-size:13px"><a href="https://www.amygb.ai/privacy-policy/"
                                                  target="_blank" style="color:#868686;text-decoration:underline;">Privacy
                                                  Policy</a></span>
  
                                      </p>
                                  </div>
                              </td>
                          </tr>
                      </table>
                  </td>
              </tr>
              <tr style="background-color:#1a1a1a; color: white;">
                  <td style="font-size: 12px;padding:10px 30px; ">© 2021 AmyGB </td>
              </tr>
          </table>
      </div>
  </body>
  
  </html>`
    return newMessage;
}

const APPROVE_EXTENSION = (payload) => {
    const newMessage = `<!DOCTYPE html>
    <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
    
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <meta name="x-apple-disable-message-reformatting">
        <title></title>
        <style>
            table,
            td,
            div,
            h1,
            p {
                font-family: Arial, sans-serif;
            }
    
            @media screen and (max-width: 530px) {
                .col-lge {
                    max-width: 100% !important;
                }
            }
    
            @media screen and (min-width: 531px) {
                .col-sml {
                    max-width: 27% !important;
                }
    
                .col-lge {
                    max-width: 73% !important;
                }
            }
        </style>
    </head>
    
    <body style="margin:0;padding:0;word-spacing:normal;">
        <div role="article" aria-roledescription="email" lang="en"
            style="text-size-adjust:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background-color:white;">
            <table role="presentation" style="width:100%;border:none;border-spacing:0;">
                <tr>
                    <td>
                        <div style="position: relative;">
                            <?xml version="1.0" encoding="utf-8"?>
                            <!-- Generator: Adobe Illustrator 24.3.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                            <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="95" height="50"
                                viewBox="0 0 1920 1080" style="enable-background:new 0 0 1920 1080;" xml:space="preserve">
                                <style type="text/css">
                                    .st0 {
                                        fill: #111111;
                                    }
    
                                    .st1 {
                                        fill: #231F20;
                                    }
    
                                    .st2 {
                                        fill: #FFDE17;
                                    }
    
                                    .st3 {
                                        fill: #D6E541;
                                    }
    
                                    .st4 {
                                        fill: #00A14B;
                                    }
    
                                    .st5 {
                                        fill: none;
                                        stroke: #F7941D;
                                        stroke-width: 2;
                                        stroke-linecap: round;
                                        stroke-linejoin: round;
                                        stroke-miterlimit: 10;
                                    }
    
                                    .subheader {
                                        width: 100%;
                                        height: 100%;
                                        font-family: Tahoma;
                                        font-size: 17px;
                                        font-weight: normal;
                                        font-stretch: normal;
                                        font-style: normal;
                                        line-height: normal;
                                        letter-spacing: normal;
                                        text-align: left;
                                        color: white;
                                    }
    
    
                                    .st6 {
                                        fill: #F7941D;
                                    }
    
                                    .st7 {
                                        fill: #FFFFFF;
                                    }
    
                                    .st8 {
                                        fill: #DA1C5C;
                                    }
    
                                    .st9 {
                                        fill: #F4C914;
                                    }
                                </style>
                                <g>
                                    <circle class="st9" cx="372.1" cy="540" r="268.78" />
                                    <g>
                                        <path d="M365.01,654.1h-63.09c-8.67,0-16.36,5.56-19.08,13.79l-4.89,14.8c-2.72,8.23-10.41,13.79-19.08,13.79h-32.68
                  c-13.95,0-23.66-13.87-18.88-26.98l80.06-219.63c2.89-7.93,10.44-13.21,18.88-13.21h55.14c8.45,0,16,5.29,18.89,13.24
                  l79.75,219.63c4.76,13.11-4.95,26.96-18.89,26.96h-33.09c-8.67,0-16.36-5.56-19.08-13.79l-4.89-14.8
                  C381.37,659.66,373.68,654.1,365.01,654.1z M352.66,572.37L352.66,572.37c-6.12-18.36-32.11-18.31-38.16,0.08l0,0
                  c-4.28,13,5.41,26.38,19.09,26.38h0C347.31,598.82,357,585.38,352.66,572.37z" />
                                    </g>
                                    <g>
                                        <path d="M757.78,535.39c12.4,13.12,18.6,31.05,18.6,53.8v94.08c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45
                  v-86.09c0-9.22-2.57-16.39-7.69-21.52c-5.13-5.12-12.1-7.68-20.9-7.68c-8.82,0-15.78,2.56-20.91,7.68
                  c-5.13,5.13-7.68,12.3-7.68,21.52v86.09c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45v-86.09
                  c0-9.22-2.51-16.39-7.53-21.52c-5.02-5.12-11.94-7.68-20.75-7.68c-9.02,0-16.09,2.56-21.21,7.68c-5.13,5.13-7.69,12.3-7.69,21.52
                  v86.09c0,3.56-2.89,6.45-6.45,6.45H487.7c-3.56,0-6.45-2.89-6.45-6.45V523.7c0-3.56,2.89-6.45,6.45-6.45h47.36
                  c3.56,0,6.45,2.89,6.45,6.45v0.26c0,5.5,6.33,8.33,10.62,4.91c3.08-2.46,6.46-4.63,10.13-6.54c8.5-4.4,18.29-6.61,29.36-6.61
                  c12.71,0,24.03,2.77,33.97,8.3c7.45,4.15,13.72,9.57,18.82,16.26c2.41,3.16,7.27,3.24,9.83,0.19c5.31-6.32,11.7-11.65,19.16-15.99
                  c10.04-5.84,21.11-8.76,33.2-8.76C728.32,515.71,745.38,522.28,757.78,535.39z" />
                                        <path
                                            d="M991.09,526.24L887.19,767.9c-1.02,2.37-3.35,3.9-5.92,3.9H830.1c-4.7,0-7.82-4.87-5.86-9.14l35.79-77.72
                  c0.76-1.66,0.79-3.56,0.07-5.23l-65.73-153.47c-1.82-4.25,1.3-8.98,5.93-8.98h52.76c2.7,0,5.11,1.68,6.04,4.2l28.57,76.99
                  c2.09,5.64,10.08,5.59,12.11-0.07l27.55-76.85c0.92-2.56,3.35-4.27,6.07-4.27h51.77C989.8,517.25,992.92,521.99,991.09,526.24z" />
                                        <path d="M1152.4,544.3c-1.98,0-3.91-0.88-5.08-2.48c-3.29-4.54-7.51-8.12-12.65-10.74c-6.05-3.07-13.17-4.61-21.37-4.61
                  c-15.17,0-27.11,4.92-35.82,14.76c-8.71,9.84-13.06,23.06-13.06,39.66c0,18.65,4.66,32.85,13.99,42.58
                  c9.32,9.74,22.9,14.6,40.73,14.6c16.81,0,29.8-6.05,38.94-18.15c3.24-4.29,0.29-10.44-5.09-10.44h-42.78
                  c-3.56,0-6.45-2.89-6.45-6.45v-30.45c0-3.56,2.89-6.45,6.45-6.45h99.62c3.56,0,6.45,2.89,6.45,6.45v50.6
                  c0,0.9-0.17,1.79-0.52,2.62c-4.7,11.01-11.44,21.35-20.23,31.03c-9.12,10.04-20.65,18.29-34.58,24.75
                  c-13.94,6.46-29.82,9.68-47.65,9.68c-21.72,0-40.94-4.66-57.64-13.99c-16.71-9.32-29.62-22.33-38.74-39.04
                  c-9.12-16.7-13.68-35.81-13.68-57.33c0-21.31,4.56-40.32,13.68-57.03c9.12-16.7,21.98-29.71,38.58-39.04
                  c16.6-9.32,35.76-13.99,57.49-13.99c27.26,0,49.8,6.56,67.63,19.67c15.65,11.52,26.09,26.75,31.32,45.69
                  c1.13,4.08-2.02,8.11-6.25,8.11H1152.4z" />
                                        <path d="M1411.96,597.33c7.48,9.74,11.22,20.86,11.22,33.36c0,18.45-6.35,32.89-19.06,43.35c-12.71,10.45-30.54,15.68-53.49,15.68
                  h-100.84c-3.56,0-6.45-2.89-6.45-6.45V479.43c0-3.56,2.89-6.45,6.45-6.45h97.46c22.13,0,39.5,4.92,52.11,14.76
                  c12.6,9.84,18.91,23.67,18.91,41.5c0,12.71-3.33,23.32-9.99,31.82c-3.64,4.64-7.93,8.48-12.88,11.5c-4.1,2.51-3.95,8.72,0.3,10.98
                  C1402.06,586.9,1407.48,591.5,1411.96,597.33z M1303.6,552.61c0,3.56,2.89,6.45,6.45,6.45h23.99c15.16,0,22.75-6.25,22.75-18.75
                  c0-12.91-7.59-19.37-22.75-19.37h-23.99c-3.56,0-6.45,2.89-6.45,6.45V552.61z M1361.39,622.08c0-6.56-2-11.58-5.99-15.06
                  c-4-3.48-9.69-5.23-17.06-5.23h-28.29c-3.56,0-6.45,2.89-6.45,6.45v26.46c0,3.56,2.89,6.45,6.45,6.45h28.6
                  C1353.81,641.14,1361.39,634.79,1361.39,622.08z" />
                                        <path d="M1453.15,683.41c-6.46-5.84-9.68-13.27-9.68-22.29c0-9.01,3.23-16.49,9.68-22.44c6.46-5.94,15.01-8.91,25.67-8.91
                  c10.45,0,18.9,2.97,25.36,8.91c6.46,5.95,9.68,13.43,9.68,22.44c0,8.82-3.23,16.19-9.68,22.14c-6.46,5.95-14.91,8.91-25.36,8.91
                  C1468.16,692.17,1459.61,689.25,1453.15,683.41z" />
                                        <path d="M1542,556.6c6.45-13.32,15.26-23.57,26.44-30.74c11.17-7.17,23.62-10.76,37.35-10.76c11.88,0,22.13,2.36,30.74,7.07
                  c3.39,1.86,6.48,3.97,9.26,6.33c4.24,3.6,10.72,0.76,10.72-4.8v0c0-3.56,2.89-6.45,6.45-6.45h47.36c3.56,0,6.45,2.89,6.45,6.45
                  v159.57c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45v-0.05c0-5.55-6.46-8.4-10.7-4.82
                  c-2.83,2.39-5.98,4.52-9.44,6.4c-8.71,4.72-18.91,7.07-30.59,7.07c-13.74,0-26.18-3.58-37.35-10.76
                  c-11.17-7.17-19.98-17.47-26.44-30.9c-6.46-13.42-9.69-29.05-9.69-46.88C1532.31,585.5,1535.54,569.93,1542,556.6z M1647.44,577.2
                  c-6.05-6.35-13.48-9.53-22.29-9.53c-9.02,0-16.5,3.13-22.44,9.38c-5.95,6.25-8.91,15.02-8.91,26.28c0,11.07,2.97,19.83,8.91,26.29
                  c7.56,8.21,17.6,11.2,30.14,8.97c0.47-0.08,0.96-0.22,1.41-0.39c14.81-5.57,22.25-17.2,22.25-34.87
                  C1656.51,592.26,1653.49,583.55,1647.44,577.2z" />
                                        <path class="st9" d="M1755.96,492.5c-6.46-5.84-9.69-13.17-9.69-21.98c0-9.02,3.23-16.5,9.69-22.44
                  c6.45-5.94,15.01-8.91,25.67-8.91c10.45,0,18.91,2.97,25.36,8.91c6.45,5.95,9.68,13.43,9.68,22.44c0,8.81-3.23,16.14-9.68,21.98
                  c-6.46,5.84-14.91,8.76-25.36,8.76C1770.97,501.26,1762.42,498.35,1755.96,492.5z" />
                                        <path d="M1811.45,523.7v159.57c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45V523.7c0-3.56,2.89-6.45,6.45-6.45
                  H1805C1808.56,517.25,1811.45,520.14,1811.45,523.7z" />
                                    </g>
                                </g>
                            </svg>
                            <div style="float: right;
      width: 95px;
      height: 50px;
      position: absolute;
      top: 25%;
      right: 2%;">
                                <img style="width: 100%"
                                    src='https://amygb-web-static.s3.ap-south-1.amazonaws.com/visionLogo.png' />
    
                            </div>
                        </div>
    
                    </td>
    
                </tr>
                <tr>
                    <td align="center" style="padding:0;">
                        <table role="presentation"
                            style="width:100%;border:none;border-spacing:0;text-align:left;font-family:Arial,sans-serif;font-size:16px;line-height:22px;">
                            <tr>
                                <td
                                    style="padding:50px 30px 50px 30px;text-align:center;font-size:24px;font-weight:bold;background-color: black;">
                                    <div class="hello" style="font-family: Tahoma;
                      font-weight: 800;
                      font-stretch: normal;
                      font-size:26px;
                      font-style: normal;
                      line-height: normal;
                      letter-spacing: normal;
                      text-align: left;
                      font-family: Tahoma;
                      color: white;">
                                        <span class="text-style-1" style="color: white;">Hello </span><span
                                            style="color: #f4c914;">${payload.firstName || payload.lastName},</span>
                                        <br />
                                        <span class="subheader" style="font-weight: bold;">
                                            Your Free Trial account has been extended by ${payload.expiryInDays} days!
                                        </span>
                                    </div>
                                    <div class="subheader" style="width: 100%;
              height: 100%;
              font-family: Tahoma;
              font-weight: normal;
              font-stretch: normal;
              font-style: normal;
              line-height: normal;
              letter-spacing: normal;
              text-align: left;
              margin-top: 1vh;
              color: white;">
                                    </div>
                                </td>
                            </tr>
    
    
                            <tr>
                                <td style="padding:30px;background-color:#f2f2f2;">
                                    <h1
                                        style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: normal;">
                                        Here is the link again
    
                                        <br />
                                        <span class="url" style="margin: 30px 183px 50px 0;
                font-family: Tahoma;
                font-size: 15px;
                font-weight: normal;
                font-stretch: normal;
                font-style: normal;
                line-height: 1.67;
                letter-spacing: normal;
                text-align: left;
                color: #006cff;">
                                            URL: <a href="${payload.url}" target="_blank">
                                                <span style="color: 006cff !important;">${payload.url}</span>
                                            </a>
                                        </span>
                                        <h1
                                        style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: normal;">
                                       Your login credentials shall remain unchanged.</h1>
    
    
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:35px 30px 0 30px;font-size:0;background-color:#ffffff;">
    
                                    <div class="col-lge"
                                        style="display:inline-block;width:100%;max-width:395px;vertical-align:top;padding-bottom:20px;font-family:Arial,sans-serif;font-size:16px;line-height:22px;color:#5e5e5e;">
    
    
    
    
                                        <h1
                                            style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: normal;">
    
                                            In order to reap maximum benefits from your Visionera free trial, we recommend a
                                            <a href="http://scheduler.amygb.ai/" target="_blank">quick call</a> with our
                                            Product
                                            experts to understand your specific requirements and guide you on best practices
                                            designed to help you
                                            achieve your goals faster.
                                        </h1>
                                        <br />
                                        <div
                                            style="margin-top:0;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: 500;color: black;">
                                            Regards,
                                        </div>
                                        <div
                                            style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: 500;">
                                            Team VisionERA
                                        </div>
                                        <br />
                                        <br />
                                        <p
                                            style="border-bottom: solid 1px lightGray;padding-bottom: 20px;margin-bottom: 20px;">
                                            <a href='https://www.facebook.com/amygb.agb/' target="_blank"
                                                style="text-decoration: none">
                                                <?xml version="1.0" encoding="iso-8859-1"?>
                                                <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                                                <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                                    xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                    viewBox="0 0 310 310" style="enable-background:new 0 0 310 310;"
                                                    xml:space="preserve" width="20" height="20" fill='#868686'>
                                                    <g id="XMLID_834_">
                                                        <path id="XMLID_835_" d="M81.703,165.106h33.981V305c0,2.762,2.238,5,5,5h57.616c2.762,0,5-2.238,5-5V165.765h39.064
              c2.54,0,4.677-1.906,4.967-4.429l5.933-51.502c0.163-1.417-0.286-2.836-1.234-3.899c-0.949-1.064-2.307-1.673-3.732-1.673h-44.996
              V71.978c0-9.732,5.24-14.667,15.576-14.667c1.473,0,29.42,0,29.42,0c2.762,0,5-2.239,5-5V5.037c0-2.762-2.238-5-5-5h-40.545
              C187.467,0.023,186.832,0,185.896,0c-7.035,0-31.488,1.381-50.804,19.151c-21.402,19.692-18.427,43.27-17.716,47.358v37.752H81.703
              c-2.762,0-5,2.238-5,5v50.844C76.703,162.867,78.941,165.106,81.703,165.106z" />
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                </svg>
                                            </a>&nbsp;&nbsp;&nbsp;&nbsp;
                                            <a href='https://twitter.com/AmyGB_ai' target="_blank"
                                                style="text-decoration: none">
                                                <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                                                <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                                    xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                    viewBox="0 0 310 310" style="enable-background:new 0 0 310 310;"
                                                    xml:space="preserve" width='20' height='20' fill='#868686'>
                                                    <g id="XMLID_826_">
                                                        <path id="XMLID_827_" d="M302.973,57.388c-4.87,2.16-9.877,3.983-14.993,5.463c6.057-6.85,10.675-14.91,13.494-23.73
              c0.632-1.977-0.023-4.141-1.648-5.434c-1.623-1.294-3.878-1.449-5.665-0.39c-10.865,6.444-22.587,11.075-34.878,13.783
              c-12.381-12.098-29.197-18.983-46.581-18.983c-36.695,0-66.549,29.853-66.549,66.547c0,2.89,0.183,5.764,0.545,8.598
              C101.163,99.244,58.83,76.863,29.76,41.204c-1.036-1.271-2.632-1.956-4.266-1.825c-1.635,0.128-3.104,1.05-3.93,2.467
              c-5.896,10.117-9.013,21.688-9.013,33.461c0,16.035,5.725,31.249,15.838,43.137c-3.075-1.065-6.059-2.396-8.907-3.977
              c-1.529-0.851-3.395-0.838-4.914,0.033c-1.52,0.871-2.473,2.473-2.513,4.224c-0.007,0.295-0.007,0.59-0.007,0.889
              c0,23.935,12.882,45.484,32.577,57.229c-1.692-0.169-3.383-0.414-5.063-0.735c-1.732-0.331-3.513,0.276-4.681,1.597
              c-1.17,1.32-1.557,3.16-1.018,4.84c7.29,22.76,26.059,39.501,48.749,44.605c-18.819,11.787-40.34,17.961-62.932,17.961
              c-4.714,0-9.455-0.277-14.095-0.826c-2.305-0.274-4.509,1.087-5.294,3.279c-0.785,2.193,0.047,4.638,2.008,5.895
              c29.023,18.609,62.582,28.445,97.047,28.445c67.754,0,110.139-31.95,133.764-58.753c29.46-33.421,46.356-77.658,46.356-121.367
              c0-1.826-0.028-3.67-0.084-5.508c11.623-8.757,21.63-19.355,29.773-31.536c1.237-1.85,1.103-4.295-0.33-5.998
              C307.394,57.037,305.009,56.486,302.973,57.388z" />
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                </svg>
                                            </a>&nbsp;&nbsp;&nbsp;&nbsp;
                                            <a href='https://www.linkedin.com/company/amygb.ai/' target="_blank">
    
                                                <?xml version="1.0" encoding="iso-8859-1"?>
                                                <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                                                <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                                    xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                    viewBox="0 0 310 310" style="enable-background:new 0 0 310 310;"
                                                    xml:space="preserve" width='20' height='20' fill='#868686'>
                                                    <g id="XMLID_801_">
                                                        <path id="XMLID_802_" d="M72.16,99.73H9.927c-2.762,0-5,2.239-5,5v199.928c0,2.762,2.238,5,5,5H72.16c2.762,0,5-2.238,5-5V104.73
              C77.16,101.969,74.922,99.73,72.16,99.73z" />
                                                        <path id="XMLID_803_" d="M41.066,0.341C18.422,0.341,0,18.743,0,41.362C0,63.991,18.422,82.4,41.066,82.4
              c22.626,0,41.033-18.41,41.033-41.038C82.1,18.743,63.692,0.341,41.066,0.341z" />
                                                        <path id="XMLID_804_" d="M230.454,94.761c-24.995,0-43.472,10.745-54.679,22.954V104.73c0-2.761-2.238-5-5-5h-59.599
              c-2.762,0-5,2.239-5,5v199.928c0,2.762,2.238,5,5,5h62.097c2.762,0,5-2.238,5-5v-98.918c0-33.333,9.054-46.319,32.29-46.319
              c25.306,0,27.317,20.818,27.317,48.034v97.204c0,2.762,2.238,5,5,5H305c2.762,0,5-2.238,5-5V194.995
              C310,145.43,300.549,94.761,230.454,94.761z" />
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                </svg>
                                            </a>
    
    
    
    
                                        </p>
                                        <p>
                                            <span style="font-size:13px"><a href="https://www.amygb.ai/contact/"
                                                    target="_blank" style="color:#868686;text-decoration:underline;">Contact
                                                    Us</a></span>&nbsp;&nbsp;&nbsp;&nbsp;
                                            <span style="font-size:13px"><a href="https://www.amygb.ai/privacy-policy/"
                                                    target="_blank" style="color:#868686;text-decoration:underline;">Privacy
                                                    Policy</a></span>
    
                                        </p>
                                    </div>
                                </td>
    
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr style="background-color:#1a1a1a; color: white;">
                    <td style="font-size: 12px;padding:10px 30px; ">© 2022 AmyGB </td>
                </tr>
            </table>
        </div>
    </body>
    
    </html>`
    return newMessage;
}
const APPROVE_STORAGE = (payload) => {
    const newMessage = `<!DOCTYPE html>
    <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
    
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <meta name="x-apple-disable-message-reformatting">
        <title></title>
        <style>
            table,
            td,
            div,
            h1,
            p {
                font-family: Arial, sans-serif;
            }
    
            @media screen and (max-width: 530px) {
                .col-lge {
                    max-width: 100% !important;
                }
            }
    
            @media screen and (min-width: 531px) {
                .col-sml {
                    max-width: 27% !important;
                }
    
                .col-lge {
                    max-width: 73% !important;
                }
            }
        </style>
    </head>
    
    <body style="margin:0;padding:0;word-spacing:normal;">
        <div role="article" aria-roledescription="email" lang="en"
            style="text-size-adjust:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background-color:white;">
            <table role="presentation" style="width:100%;border:none;border-spacing:0;">
                <tr>
                    <td>
                        <div style="position: relative;">
                            <?xml version="1.0" encoding="utf-8"?>
                            <!-- Generator: Adobe Illustrator 24.3.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                            <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="95" height="50"
                                viewBox="0 0 1920 1080" style="enable-background:new 0 0 1920 1080;" xml:space="preserve">
                                <style type="text/css">
                                    .st0 {
                                        fill: #111111;
                                    }
    
                                    .st1 {
                                        fill: #231F20;
                                    }
    
                                    .st2 {
                                        fill: #FFDE17;
                                    }
    
                                    .st3 {
                                        fill: #D6E541;
                                    }
    
                                    .st4 {
                                        fill: #00A14B;
                                    }
    
                                    .st5 {
                                        fill: none;
                                        stroke: #F7941D;
                                        stroke-width: 2;
                                        stroke-linecap: round;
                                        stroke-linejoin: round;
                                        stroke-miterlimit: 10;
                                    }
    
                                    .subheader {
                                        width: 100%;
                                        height: 100%;
                                        font-family: Tahoma;
                                        font-size: 17px;
                                        font-weight: normal;
                                        font-stretch: normal;
                                        font-style: normal;
                                        line-height: normal;
                                        letter-spacing: normal;
                                        text-align: left;
                                        color: white;
                                    }
    
    
                                    .st6 {
                                        fill: #F7941D;
                                    }
    
                                    .st7 {
                                        fill: #FFFFFF;
                                    }
    
                                    .st8 {
                                        fill: #DA1C5C;
                                    }
    
                                    .st9 {
                                        fill: #F4C914;
                                    }
                                </style>
                                <g>
                                    <circle class="st9" cx="372.1" cy="540" r="268.78" />
                                    <g>
                                        <path d="M365.01,654.1h-63.09c-8.67,0-16.36,5.56-19.08,13.79l-4.89,14.8c-2.72,8.23-10.41,13.79-19.08,13.79h-32.68
                  c-13.95,0-23.66-13.87-18.88-26.98l80.06-219.63c2.89-7.93,10.44-13.21,18.88-13.21h55.14c8.45,0,16,5.29,18.89,13.24
                  l79.75,219.63c4.76,13.11-4.95,26.96-18.89,26.96h-33.09c-8.67,0-16.36-5.56-19.08-13.79l-4.89-14.8
                  C381.37,659.66,373.68,654.1,365.01,654.1z M352.66,572.37L352.66,572.37c-6.12-18.36-32.11-18.31-38.16,0.08l0,0
                  c-4.28,13,5.41,26.38,19.09,26.38h0C347.31,598.82,357,585.38,352.66,572.37z" />
                                    </g>
                                    <g>
                                        <path d="M757.78,535.39c12.4,13.12,18.6,31.05,18.6,53.8v94.08c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45
                  v-86.09c0-9.22-2.57-16.39-7.69-21.52c-5.13-5.12-12.1-7.68-20.9-7.68c-8.82,0-15.78,2.56-20.91,7.68
                  c-5.13,5.13-7.68,12.3-7.68,21.52v86.09c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45v-86.09
                  c0-9.22-2.51-16.39-7.53-21.52c-5.02-5.12-11.94-7.68-20.75-7.68c-9.02,0-16.09,2.56-21.21,7.68c-5.13,5.13-7.69,12.3-7.69,21.52
                  v86.09c0,3.56-2.89,6.45-6.45,6.45H487.7c-3.56,0-6.45-2.89-6.45-6.45V523.7c0-3.56,2.89-6.45,6.45-6.45h47.36
                  c3.56,0,6.45,2.89,6.45,6.45v0.26c0,5.5,6.33,8.33,10.62,4.91c3.08-2.46,6.46-4.63,10.13-6.54c8.5-4.4,18.29-6.61,29.36-6.61
                  c12.71,0,24.03,2.77,33.97,8.3c7.45,4.15,13.72,9.57,18.82,16.26c2.41,3.16,7.27,3.24,9.83,0.19c5.31-6.32,11.7-11.65,19.16-15.99
                  c10.04-5.84,21.11-8.76,33.2-8.76C728.32,515.71,745.38,522.28,757.78,535.39z" />
                                        <path
                                            d="M991.09,526.24L887.19,767.9c-1.02,2.37-3.35,3.9-5.92,3.9H830.1c-4.7,0-7.82-4.87-5.86-9.14l35.79-77.72
                  c0.76-1.66,0.79-3.56,0.07-5.23l-65.73-153.47c-1.82-4.25,1.3-8.98,5.93-8.98h52.76c2.7,0,5.11,1.68,6.04,4.2l28.57,76.99
                  c2.09,5.64,10.08,5.59,12.11-0.07l27.55-76.85c0.92-2.56,3.35-4.27,6.07-4.27h51.77C989.8,517.25,992.92,521.99,991.09,526.24z" />
                                        <path d="M1152.4,544.3c-1.98,0-3.91-0.88-5.08-2.48c-3.29-4.54-7.51-8.12-12.65-10.74c-6.05-3.07-13.17-4.61-21.37-4.61
                  c-15.17,0-27.11,4.92-35.82,14.76c-8.71,9.84-13.06,23.06-13.06,39.66c0,18.65,4.66,32.85,13.99,42.58
                  c9.32,9.74,22.9,14.6,40.73,14.6c16.81,0,29.8-6.05,38.94-18.15c3.24-4.29,0.29-10.44-5.09-10.44h-42.78
                  c-3.56,0-6.45-2.89-6.45-6.45v-30.45c0-3.56,2.89-6.45,6.45-6.45h99.62c3.56,0,6.45,2.89,6.45,6.45v50.6
                  c0,0.9-0.17,1.79-0.52,2.62c-4.7,11.01-11.44,21.35-20.23,31.03c-9.12,10.04-20.65,18.29-34.58,24.75
                  c-13.94,6.46-29.82,9.68-47.65,9.68c-21.72,0-40.94-4.66-57.64-13.99c-16.71-9.32-29.62-22.33-38.74-39.04
                  c-9.12-16.7-13.68-35.81-13.68-57.33c0-21.31,4.56-40.32,13.68-57.03c9.12-16.7,21.98-29.71,38.58-39.04
                  c16.6-9.32,35.76-13.99,57.49-13.99c27.26,0,49.8,6.56,67.63,19.67c15.65,11.52,26.09,26.75,31.32,45.69
                  c1.13,4.08-2.02,8.11-6.25,8.11H1152.4z" />
                                        <path d="M1411.96,597.33c7.48,9.74,11.22,20.86,11.22,33.36c0,18.45-6.35,32.89-19.06,43.35c-12.71,10.45-30.54,15.68-53.49,15.68
                  h-100.84c-3.56,0-6.45-2.89-6.45-6.45V479.43c0-3.56,2.89-6.45,6.45-6.45h97.46c22.13,0,39.5,4.92,52.11,14.76
                  c12.6,9.84,18.91,23.67,18.91,41.5c0,12.71-3.33,23.32-9.99,31.82c-3.64,4.64-7.93,8.48-12.88,11.5c-4.1,2.51-3.95,8.72,0.3,10.98
                  C1402.06,586.9,1407.48,591.5,1411.96,597.33z M1303.6,552.61c0,3.56,2.89,6.45,6.45,6.45h23.99c15.16,0,22.75-6.25,22.75-18.75
                  c0-12.91-7.59-19.37-22.75-19.37h-23.99c-3.56,0-6.45,2.89-6.45,6.45V552.61z M1361.39,622.08c0-6.56-2-11.58-5.99-15.06
                  c-4-3.48-9.69-5.23-17.06-5.23h-28.29c-3.56,0-6.45,2.89-6.45,6.45v26.46c0,3.56,2.89,6.45,6.45,6.45h28.6
                  C1353.81,641.14,1361.39,634.79,1361.39,622.08z" />
                                        <path d="M1453.15,683.41c-6.46-5.84-9.68-13.27-9.68-22.29c0-9.01,3.23-16.49,9.68-22.44c6.46-5.94,15.01-8.91,25.67-8.91
                  c10.45,0,18.9,2.97,25.36,8.91c6.46,5.95,9.68,13.43,9.68,22.44c0,8.82-3.23,16.19-9.68,22.14c-6.46,5.95-14.91,8.91-25.36,8.91
                  C1468.16,692.17,1459.61,689.25,1453.15,683.41z" />
                                        <path d="M1542,556.6c6.45-13.32,15.26-23.57,26.44-30.74c11.17-7.17,23.62-10.76,37.35-10.76c11.88,0,22.13,2.36,30.74,7.07
                  c3.39,1.86,6.48,3.97,9.26,6.33c4.24,3.6,10.72,0.76,10.72-4.8v0c0-3.56,2.89-6.45,6.45-6.45h47.36c3.56,0,6.45,2.89,6.45,6.45
                  v159.57c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45v-0.05c0-5.55-6.46-8.4-10.7-4.82
                  c-2.83,2.39-5.98,4.52-9.44,6.4c-8.71,4.72-18.91,7.07-30.59,7.07c-13.74,0-26.18-3.58-37.35-10.76
                  c-11.17-7.17-19.98-17.47-26.44-30.9c-6.46-13.42-9.69-29.05-9.69-46.88C1532.31,585.5,1535.54,569.93,1542,556.6z M1647.44,577.2
                  c-6.05-6.35-13.48-9.53-22.29-9.53c-9.02,0-16.5,3.13-22.44,9.38c-5.95,6.25-8.91,15.02-8.91,26.28c0,11.07,2.97,19.83,8.91,26.29
                  c7.56,8.21,17.6,11.2,30.14,8.97c0.47-0.08,0.96-0.22,1.41-0.39c14.81-5.57,22.25-17.2,22.25-34.87
                  C1656.51,592.26,1653.49,583.55,1647.44,577.2z" />
                                        <path class="st9" d="M1755.96,492.5c-6.46-5.84-9.69-13.17-9.69-21.98c0-9.02,3.23-16.5,9.69-22.44
                  c6.45-5.94,15.01-8.91,25.67-8.91c10.45,0,18.91,2.97,25.36,8.91c6.45,5.95,9.68,13.43,9.68,22.44c0,8.81-3.23,16.14-9.68,21.98
                  c-6.46,5.84-14.91,8.76-25.36,8.76C1770.97,501.26,1762.42,498.35,1755.96,492.5z" />
                                        <path d="M1811.45,523.7v159.57c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45V523.7c0-3.56,2.89-6.45,6.45-6.45
                  H1805C1808.56,517.25,1811.45,520.14,1811.45,523.7z" />
                                    </g>
                                </g>
                            </svg>
                            <div style="float: right;
      width: 95px;
      height: 50px;
      position: absolute;
      top: 25%;
      right: 2%;">
                                <img style="width: 100%"
                                    src='https://amygb-web-static.s3.ap-south-1.amazonaws.com/visionLogo.png' />
    
                            </div>
                        </div>
    
                    </td>
    
                </tr>
                <tr>
                    <td align="center" style="padding:0;">
                        <table role="presentation"
                            style="width:100%;border:none;border-spacing:0;text-align:left;font-family:Arial,sans-serif;font-size:16px;line-height:22px;">
                            <tr>
                                <td
                                    style="padding:50px 30px 50px 30px;text-align:center;font-size:24px;font-weight:bold;background-color: black;">
                                    <div class="hello" style="font-family: Tahoma;
                      font-weight: 800;
                      font-stretch: normal;
                      font-size:26px;
                      font-style: normal;
                      line-height: normal;
                      letter-spacing: normal;
                      text-align: left;
                      font-family: Tahoma;
                      color: white;">
                                        <span class="text-style-1" style="color: white;">Hello </span><span
                                            style="color: #f4c914;">${payload.firstName || payload.lastName},</span>
                                        <br />
                                        <span class="subheader" style="font-weight: bold;">
                                            You can continue to explore VisionERA. We have increased your Trial Quota by
                                            ${payload.extendStorage}!
                                        </span>
                                    </div>
                                    <div class="subheader" style="width: 100%;
              height: 100%;
              font-family: Tahoma;
              font-weight: normal;
              font-stretch: normal;
              font-style: normal;
              line-height: normal;
              letter-spacing: normal;
              text-align: left;
              margin-top: 1vh;
              color: white;">
                                    </div>
                                </td>
                            </tr>
    
    
                            <tr>
                                <td style="padding:30px;background-color:#f2f2f2;">
                                    <h1
                                        style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: normal;">
                                        Here is the link again
    
                                        <br />
                                        <span class="url" style="margin: 30px 183px 50px 0;
                font-family: Tahoma;
                font-size: 15px;
                font-weight: normal;
                font-stretch: normal;
                font-style: normal;
                line-height: 1.67;
                letter-spacing: normal;
                text-align: left;
                color: #006cff;">
                                            URL: <a href="${payload.url}" target="_blank">
                                                <span style="color: 006cff !important;">${payload.url}</span>
                                            </a>
                                        </span>
                                        <h1
                                        style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: normal;">
                                       Your login credentials shall remain unchanged.</h1>
    
    
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:35px 30px 0 30px;font-size:0;background-color:#ffffff;">
    
                                    <div class="col-lge"
                                        style="display:inline-block;width:100%;max-width:395px;vertical-align:top;padding-bottom:20px;font-family:Arial,sans-serif;font-size:16px;line-height:22px;color:#5e5e5e;">
    
    
    
    
                                        <h1
                                            style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: normal;">
    
                                            In order to reap maximum benefits from your Visionera free trial, we recommend a
                                            <a href="http://scheduler.amygb.ai/" target="_blank">quick call</a> with our
                                            Product
                                            experts to understand your specific requirements and guide you on best practices
                                            designed to help you
                                            achieve your goals faster.
                                        </h1>
                                        <br />
                                        <div
                                            style="margin-top:0;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: 500;color: black;">
                                            Regards,
                                        </div>
                                        <div
                                            style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: 500;">
                                            Team VisionERA
                                        </div>
                                        <br />
                                        <br />
                                        <p
                                            style="border-bottom: solid 1px lightGray;padding-bottom: 20px;margin-bottom: 20px;">
                                            <a href='https://www.facebook.com/amygb.agb/' target="_blank"
                                                style="text-decoration: none">
                                                <?xml version="1.0" encoding="iso-8859-1"?>
                                                <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                                                <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                                    xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                    viewBox="0 0 310 310" style="enable-background:new 0 0 310 310;"
                                                    xml:space="preserve" width="20" height="20" fill='#868686'>
                                                    <g id="XMLID_834_">
                                                        <path id="XMLID_835_" d="M81.703,165.106h33.981V305c0,2.762,2.238,5,5,5h57.616c2.762,0,5-2.238,5-5V165.765h39.064
              c2.54,0,4.677-1.906,4.967-4.429l5.933-51.502c0.163-1.417-0.286-2.836-1.234-3.899c-0.949-1.064-2.307-1.673-3.732-1.673h-44.996
              V71.978c0-9.732,5.24-14.667,15.576-14.667c1.473,0,29.42,0,29.42,0c2.762,0,5-2.239,5-5V5.037c0-2.762-2.238-5-5-5h-40.545
              C187.467,0.023,186.832,0,185.896,0c-7.035,0-31.488,1.381-50.804,19.151c-21.402,19.692-18.427,43.27-17.716,47.358v37.752H81.703
              c-2.762,0-5,2.238-5,5v50.844C76.703,162.867,78.941,165.106,81.703,165.106z" />
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                </svg>
                                            </a>&nbsp;&nbsp;&nbsp;&nbsp;
                                            <a href='https://twitter.com/AmyGB_ai' target="_blank"
                                                style="text-decoration: none">
                                                <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                                                <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                                    xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                    viewBox="0 0 310 310" style="enable-background:new 0 0 310 310;"
                                                    xml:space="preserve" width='20' height='20' fill='#868686'>
                                                    <g id="XMLID_826_">
                                                        <path id="XMLID_827_" d="M302.973,57.388c-4.87,2.16-9.877,3.983-14.993,5.463c6.057-6.85,10.675-14.91,13.494-23.73
              c0.632-1.977-0.023-4.141-1.648-5.434c-1.623-1.294-3.878-1.449-5.665-0.39c-10.865,6.444-22.587,11.075-34.878,13.783
              c-12.381-12.098-29.197-18.983-46.581-18.983c-36.695,0-66.549,29.853-66.549,66.547c0,2.89,0.183,5.764,0.545,8.598
              C101.163,99.244,58.83,76.863,29.76,41.204c-1.036-1.271-2.632-1.956-4.266-1.825c-1.635,0.128-3.104,1.05-3.93,2.467
              c-5.896,10.117-9.013,21.688-9.013,33.461c0,16.035,5.725,31.249,15.838,43.137c-3.075-1.065-6.059-2.396-8.907-3.977
              c-1.529-0.851-3.395-0.838-4.914,0.033c-1.52,0.871-2.473,2.473-2.513,4.224c-0.007,0.295-0.007,0.59-0.007,0.889
              c0,23.935,12.882,45.484,32.577,57.229c-1.692-0.169-3.383-0.414-5.063-0.735c-1.732-0.331-3.513,0.276-4.681,1.597
              c-1.17,1.32-1.557,3.16-1.018,4.84c7.29,22.76,26.059,39.501,48.749,44.605c-18.819,11.787-40.34,17.961-62.932,17.961
              c-4.714,0-9.455-0.277-14.095-0.826c-2.305-0.274-4.509,1.087-5.294,3.279c-0.785,2.193,0.047,4.638,2.008,5.895
              c29.023,18.609,62.582,28.445,97.047,28.445c67.754,0,110.139-31.95,133.764-58.753c29.46-33.421,46.356-77.658,46.356-121.367
              c0-1.826-0.028-3.67-0.084-5.508c11.623-8.757,21.63-19.355,29.773-31.536c1.237-1.85,1.103-4.295-0.33-5.998
              C307.394,57.037,305.009,56.486,302.973,57.388z" />
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                </svg>
                                            </a>&nbsp;&nbsp;&nbsp;&nbsp;
                                            <a href='https://www.linkedin.com/company/amygb.ai/' target="_blank">
    
                                                <?xml version="1.0" encoding="iso-8859-1"?>
                                                <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                                                <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                                    xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                    viewBox="0 0 310 310" style="enable-background:new 0 0 310 310;"
                                                    xml:space="preserve" width='20' height='20' fill='#868686'>
                                                    <g id="XMLID_801_">
                                                        <path id="XMLID_802_" d="M72.16,99.73H9.927c-2.762,0-5,2.239-5,5v199.928c0,2.762,2.238,5,5,5H72.16c2.762,0,5-2.238,5-5V104.73
              C77.16,101.969,74.922,99.73,72.16,99.73z" />
                                                        <path id="XMLID_803_" d="M41.066,0.341C18.422,0.341,0,18.743,0,41.362C0,63.991,18.422,82.4,41.066,82.4
              c22.626,0,41.033-18.41,41.033-41.038C82.1,18.743,63.692,0.341,41.066,0.341z" />
                                                        <path id="XMLID_804_" d="M230.454,94.761c-24.995,0-43.472,10.745-54.679,22.954V104.73c0-2.761-2.238-5-5-5h-59.599
              c-2.762,0-5,2.239-5,5v199.928c0,2.762,2.238,5,5,5h62.097c2.762,0,5-2.238,5-5v-98.918c0-33.333,9.054-46.319,32.29-46.319
              c25.306,0,27.317,20.818,27.317,48.034v97.204c0,2.762,2.238,5,5,5H305c2.762,0,5-2.238,5-5V194.995
              C310,145.43,300.549,94.761,230.454,94.761z" />
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                </svg>
                                            </a>
    
    
    
    
                                        </p>
                                        <p>
                                            <span style="font-size:13px"><a href="https://www.amygb.ai/contact/"
                                                    target="_blank" style="color:#868686;text-decoration:underline;">Contact
                                                    Us</a></span>&nbsp;&nbsp;&nbsp;&nbsp;
                                            <span style="font-size:13px"><a href="https://www.amygb.ai/privacy-policy/"
                                                    target="_blank" style="color:#868686;text-decoration:underline;">Privacy
                                                    Policy</a></span>
    
                                        </p>
                                    </div>
                                </td>
    
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr style="background-color:#1a1a1a; color: white;">
                    <td style="font-size: 12px;padding:10px 30px; ">© 2022 AmyGB </td>
                </tr>
            </table>
        </div>
    </body>
    
    </html>`;
    return newMessage;
}
const REQUEST_EXTENSION = (payload) => {
    const newMessage = `<!DOCTYPE html>
    <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
    
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <meta name="x-apple-disable-message-reformatting">
        <title></title>
        <style>
            table,
            td,
            div,
            h1,
            p {
                font-family: Arial, sans-serif;
            }
    
            @media screen and (max-width: 530px) {
                .col-lge {
                    max-width: 100% !important;
                }
            }
    
            @media screen and (min-width: 531px) {
                .col-sml {
                    max-width: 27% !important;
                }
    
                .col-lge {
                    max-width: 73% !important;
                }
            }
        </style>
    </head>
    
    <body style="margin:0;padding:0;word-spacing:normal;">
        <div role="article" aria-roledescription="email" lang="en"
            style="text-size-adjust:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background-color:white;">
            <table role="presentation" style="width:100%;border:none;border-spacing:0;">
                <tr>
                    <td>
                        <div style="position: relative;">
                            <?xml version="1.0" encoding="utf-8"?>
                            <!-- Generator: Adobe Illustrator 24.3.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                            <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="95" height="50"
                                viewBox="0 0 1920 1080" style="enable-background:new 0 0 1920 1080;" xml:space="preserve">
                                <style type="text/css">
                                    .st0 {
                                        fill: #111111;
                                    }
    
                                    .st1 {
                                        fill: #231F20;
                                    }
    
                                    .st2 {
                                        fill: #FFDE17;
                                    }
    
                                    .st3 {
                                        fill: #D6E541;
                                    }
    
                                    .st4 {
                                        fill: #00A14B;
                                    }
    
                                    .st5 {
                                        fill: none;
                                        stroke: #F7941D;
                                        stroke-width: 2;
                                        stroke-linecap: round;
                                        stroke-linejoin: round;
                                        stroke-miterlimit: 10;
                                    }
    
                                    .subheader {
                                        width: 100%;
                                        height: 100%;
                                        font-family: Tahoma;
                                        font-size: 17px;
                                        font-weight: normal;
                                        font-stretch: normal;
                                        font-style: normal;
                                        line-height: normal;
                                        letter-spacing: normal;
                                        text-align: left;
                                        color: white;
                                    }
    
    
                                    .st6 {
                                        fill: #F7941D;
                                    }
    
                                    .st7 {
                                        fill: #FFFFFF;
                                    }
    
                                    .st8 {
                                        fill: #DA1C5C;
                                    }
    
                                    .st9 {
                                        fill: #F4C914;
                                    }
                                </style>
                                <g>
                                    <circle class="st9" cx="372.1" cy="540" r="268.78" />
                                    <g>
                                        <path d="M365.01,654.1h-63.09c-8.67,0-16.36,5.56-19.08,13.79l-4.89,14.8c-2.72,8.23-10.41,13.79-19.08,13.79h-32.68
                  c-13.95,0-23.66-13.87-18.88-26.98l80.06-219.63c2.89-7.93,10.44-13.21,18.88-13.21h55.14c8.45,0,16,5.29,18.89,13.24
                  l79.75,219.63c4.76,13.11-4.95,26.96-18.89,26.96h-33.09c-8.67,0-16.36-5.56-19.08-13.79l-4.89-14.8
                  C381.37,659.66,373.68,654.1,365.01,654.1z M352.66,572.37L352.66,572.37c-6.12-18.36-32.11-18.31-38.16,0.08l0,0
                  c-4.28,13,5.41,26.38,19.09,26.38h0C347.31,598.82,357,585.38,352.66,572.37z" />
                                    </g>
                                    <g>
                                        <path d="M757.78,535.39c12.4,13.12,18.6,31.05,18.6,53.8v94.08c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45
                  v-86.09c0-9.22-2.57-16.39-7.69-21.52c-5.13-5.12-12.1-7.68-20.9-7.68c-8.82,0-15.78,2.56-20.91,7.68
                  c-5.13,5.13-7.68,12.3-7.68,21.52v86.09c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45v-86.09
                  c0-9.22-2.51-16.39-7.53-21.52c-5.02-5.12-11.94-7.68-20.75-7.68c-9.02,0-16.09,2.56-21.21,7.68c-5.13,5.13-7.69,12.3-7.69,21.52
                  v86.09c0,3.56-2.89,6.45-6.45,6.45H487.7c-3.56,0-6.45-2.89-6.45-6.45V523.7c0-3.56,2.89-6.45,6.45-6.45h47.36
                  c3.56,0,6.45,2.89,6.45,6.45v0.26c0,5.5,6.33,8.33,10.62,4.91c3.08-2.46,6.46-4.63,10.13-6.54c8.5-4.4,18.29-6.61,29.36-6.61
                  c12.71,0,24.03,2.77,33.97,8.3c7.45,4.15,13.72,9.57,18.82,16.26c2.41,3.16,7.27,3.24,9.83,0.19c5.31-6.32,11.7-11.65,19.16-15.99
                  c10.04-5.84,21.11-8.76,33.2-8.76C728.32,515.71,745.38,522.28,757.78,535.39z" />
                                        <path
                                            d="M991.09,526.24L887.19,767.9c-1.02,2.37-3.35,3.9-5.92,3.9H830.1c-4.7,0-7.82-4.87-5.86-9.14l35.79-77.72
                  c0.76-1.66,0.79-3.56,0.07-5.23l-65.73-153.47c-1.82-4.25,1.3-8.98,5.93-8.98h52.76c2.7,0,5.11,1.68,6.04,4.2l28.57,76.99
                  c2.09,5.64,10.08,5.59,12.11-0.07l27.55-76.85c0.92-2.56,3.35-4.27,6.07-4.27h51.77C989.8,517.25,992.92,521.99,991.09,526.24z" />
                                        <path d="M1152.4,544.3c-1.98,0-3.91-0.88-5.08-2.48c-3.29-4.54-7.51-8.12-12.65-10.74c-6.05-3.07-13.17-4.61-21.37-4.61
                  c-15.17,0-27.11,4.92-35.82,14.76c-8.71,9.84-13.06,23.06-13.06,39.66c0,18.65,4.66,32.85,13.99,42.58
                  c9.32,9.74,22.9,14.6,40.73,14.6c16.81,0,29.8-6.05,38.94-18.15c3.24-4.29,0.29-10.44-5.09-10.44h-42.78
                  c-3.56,0-6.45-2.89-6.45-6.45v-30.45c0-3.56,2.89-6.45,6.45-6.45h99.62c3.56,0,6.45,2.89,6.45,6.45v50.6
                  c0,0.9-0.17,1.79-0.52,2.62c-4.7,11.01-11.44,21.35-20.23,31.03c-9.12,10.04-20.65,18.29-34.58,24.75
                  c-13.94,6.46-29.82,9.68-47.65,9.68c-21.72,0-40.94-4.66-57.64-13.99c-16.71-9.32-29.62-22.33-38.74-39.04
                  c-9.12-16.7-13.68-35.81-13.68-57.33c0-21.31,4.56-40.32,13.68-57.03c9.12-16.7,21.98-29.71,38.58-39.04
                  c16.6-9.32,35.76-13.99,57.49-13.99c27.26,0,49.8,6.56,67.63,19.67c15.65,11.52,26.09,26.75,31.32,45.69
                  c1.13,4.08-2.02,8.11-6.25,8.11H1152.4z" />
                                        <path d="M1411.96,597.33c7.48,9.74,11.22,20.86,11.22,33.36c0,18.45-6.35,32.89-19.06,43.35c-12.71,10.45-30.54,15.68-53.49,15.68
                  h-100.84c-3.56,0-6.45-2.89-6.45-6.45V479.43c0-3.56,2.89-6.45,6.45-6.45h97.46c22.13,0,39.5,4.92,52.11,14.76
                  c12.6,9.84,18.91,23.67,18.91,41.5c0,12.71-3.33,23.32-9.99,31.82c-3.64,4.64-7.93,8.48-12.88,11.5c-4.1,2.51-3.95,8.72,0.3,10.98
                  C1402.06,586.9,1407.48,591.5,1411.96,597.33z M1303.6,552.61c0,3.56,2.89,6.45,6.45,6.45h23.99c15.16,0,22.75-6.25,22.75-18.75
                  c0-12.91-7.59-19.37-22.75-19.37h-23.99c-3.56,0-6.45,2.89-6.45,6.45V552.61z M1361.39,622.08c0-6.56-2-11.58-5.99-15.06
                  c-4-3.48-9.69-5.23-17.06-5.23h-28.29c-3.56,0-6.45,2.89-6.45,6.45v26.46c0,3.56,2.89,6.45,6.45,6.45h28.6
                  C1353.81,641.14,1361.39,634.79,1361.39,622.08z" />
                                        <path d="M1453.15,683.41c-6.46-5.84-9.68-13.27-9.68-22.29c0-9.01,3.23-16.49,9.68-22.44c6.46-5.94,15.01-8.91,25.67-8.91
                  c10.45,0,18.9,2.97,25.36,8.91c6.46,5.95,9.68,13.43,9.68,22.44c0,8.82-3.23,16.19-9.68,22.14c-6.46,5.95-14.91,8.91-25.36,8.91
                  C1468.16,692.17,1459.61,689.25,1453.15,683.41z" />
                                        <path d="M1542,556.6c6.45-13.32,15.26-23.57,26.44-30.74c11.17-7.17,23.62-10.76,37.35-10.76c11.88,0,22.13,2.36,30.74,7.07
                  c3.39,1.86,6.48,3.97,9.26,6.33c4.24,3.6,10.72,0.76,10.72-4.8v0c0-3.56,2.89-6.45,6.45-6.45h47.36c3.56,0,6.45,2.89,6.45,6.45
                  v159.57c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45v-0.05c0-5.55-6.46-8.4-10.7-4.82
                  c-2.83,2.39-5.98,4.52-9.44,6.4c-8.71,4.72-18.91,7.07-30.59,7.07c-13.74,0-26.18-3.58-37.35-10.76
                  c-11.17-7.17-19.98-17.47-26.44-30.9c-6.46-13.42-9.69-29.05-9.69-46.88C1532.31,585.5,1535.54,569.93,1542,556.6z M1647.44,577.2
                  c-6.05-6.35-13.48-9.53-22.29-9.53c-9.02,0-16.5,3.13-22.44,9.38c-5.95,6.25-8.91,15.02-8.91,26.28c0,11.07,2.97,19.83,8.91,26.29
                  c7.56,8.21,17.6,11.2,30.14,8.97c0.47-0.08,0.96-0.22,1.41-0.39c14.81-5.57,22.25-17.2,22.25-34.87
                  C1656.51,592.26,1653.49,583.55,1647.44,577.2z" />
                                        <path class="st9" d="M1755.96,492.5c-6.46-5.84-9.69-13.17-9.69-21.98c0-9.02,3.23-16.5,9.69-22.44
                  c6.45-5.94,15.01-8.91,25.67-8.91c10.45,0,18.91,2.97,25.36,8.91c6.45,5.95,9.68,13.43,9.68,22.44c0,8.81-3.23,16.14-9.68,21.98
                  c-6.46,5.84-14.91,8.76-25.36,8.76C1770.97,501.26,1762.42,498.35,1755.96,492.5z" />
                                        <path d="M1811.45,523.7v159.57c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45V523.7c0-3.56,2.89-6.45,6.45-6.45
                  H1805C1808.56,517.25,1811.45,520.14,1811.45,523.7z" />
                                    </g>
                                </g>
                            </svg>
                            <div style="float: right;
      width: 95px;
      height: 50px;
      position: absolute;
      top: 25%;
      right: 2%;">
                                <img style="width: 100%"
                                    src='https://amygb-web-static.s3.ap-south-1.amazonaws.com/visionLogo.png' />
    
                            </div>
                        </div>
    
                    </td>
    
                </tr>
                <tr>
                    <td align="center" style="padding:0;">
                        <table role="presentation"
                            style="width:100%;border:none;border-spacing:0;text-align:left;font-family:Arial,sans-serif;font-size:16px;line-height:22px;">
                            <tr>
                                <td
                                    style="padding:50px 30px 50px 30px;text-align:center;font-size:24px;font-weight:bold;background-color: black;">
                                    <div class="hello" style="font-family: Tahoma;
                      font-weight: 800;
                      font-stretch: normal;
                      font-size:26px;
                      font-style: normal;
                      line-height: normal;
                      letter-spacing: normal;
                      text-align: left;
                      font-family: Tahoma;
                      color: white;">
                                        <span class="text-style-1" style="color: white;">Hello </span><span
                                            style="color: #f4c914;">${payload.firstName || payload.lastName},</span>
                                        <br />
                                        <span class="subheader" style="font-weight: bold;">
                                            Thank you for your continued interest! We have received your request for Trial Extension.
                                        </span>
                                    </div>
                                    <div class="subheader" style="width: 100%;
              height: 100%;
              font-family: Tahoma;
              font-weight: normal;
              font-stretch: normal;
              font-style: normal;
              line-height: normal;
              letter-spacing: normal;
              text-align: left;
              margin-top: 1vh;
              color: white;">
                                    </div>
                                </td>
                            </tr>
    
    
                            <tr>
                                <td style="padding:30px;background-color:#f2f2f2;">
                                    <h1
                                        style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: normal;">
                                        Your request for extending the Trial validity is in consideration. We will send a response
                                        to your registered email address within 2 business days.
    
                                        <br />
                                       
    
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:35px 30px 0 30px;font-size:0;background-color:#ffffff;">
    
                                    <div class="col-lge"
                                        style="display:inline-block;width:100%;max-width:395px;vertical-align:top;padding-bottom:20px;font-family:Arial,sans-serif;font-size:16px;line-height:22px;color:#5e5e5e;">
    
    
    
    
                                        <h1
                                            style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: normal;">
    
                                            In order to reap maximum benefits from your Visionera free trial, we recommend a
                                            <a href="http://scheduler.amygb.ai/" target="_blank">quick call</a> with our
                                            Product
                                            experts to understand your specific requirements and guide you on best practices
                                            designed to help you
                                            achieve your goals faster.
                                        </h1>
                                        <br />
                                        <div
                                            style="margin-top:0;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: 500;color: black;">
                                            Regards,
                                        </div>
                                        <div
                                            style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: 500;">
                                            Team VisionERA
                                        </div>
                                        <br />
                                        <br />
                                        <p
                                            style="border-bottom: solid 1px lightGray;padding-bottom: 20px;margin-bottom: 20px;">
                                            <a href='https://www.facebook.com/amygb.agb/' target="_blank"
                                                style="text-decoration: none">
                                                <?xml version="1.0" encoding="iso-8859-1"?>
                                                <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                                                <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                                    xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                    viewBox="0 0 310 310" style="enable-background:new 0 0 310 310;"
                                                    xml:space="preserve" width="20" height="20" fill='#868686'>
                                                    <g id="XMLID_834_">
                                                        <path id="XMLID_835_" d="M81.703,165.106h33.981V305c0,2.762,2.238,5,5,5h57.616c2.762,0,5-2.238,5-5V165.765h39.064
              c2.54,0,4.677-1.906,4.967-4.429l5.933-51.502c0.163-1.417-0.286-2.836-1.234-3.899c-0.949-1.064-2.307-1.673-3.732-1.673h-44.996
              V71.978c0-9.732,5.24-14.667,15.576-14.667c1.473,0,29.42,0,29.42,0c2.762,0,5-2.239,5-5V5.037c0-2.762-2.238-5-5-5h-40.545
              C187.467,0.023,186.832,0,185.896,0c-7.035,0-31.488,1.381-50.804,19.151c-21.402,19.692-18.427,43.27-17.716,47.358v37.752H81.703
              c-2.762,0-5,2.238-5,5v50.844C76.703,162.867,78.941,165.106,81.703,165.106z" />
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                </svg>
                                            </a>&nbsp;&nbsp;&nbsp;&nbsp;
                                            <a href='https://twitter.com/AmyGB_ai' target="_blank"
                                                style="text-decoration: none">
                                                <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                                                <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                                    xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                    viewBox="0 0 310 310" style="enable-background:new 0 0 310 310;"
                                                    xml:space="preserve" width='20' height='20' fill='#868686'>
                                                    <g id="XMLID_826_">
                                                        <path id="XMLID_827_" d="M302.973,57.388c-4.87,2.16-9.877,3.983-14.993,5.463c6.057-6.85,10.675-14.91,13.494-23.73
              c0.632-1.977-0.023-4.141-1.648-5.434c-1.623-1.294-3.878-1.449-5.665-0.39c-10.865,6.444-22.587,11.075-34.878,13.783
              c-12.381-12.098-29.197-18.983-46.581-18.983c-36.695,0-66.549,29.853-66.549,66.547c0,2.89,0.183,5.764,0.545,8.598
              C101.163,99.244,58.83,76.863,29.76,41.204c-1.036-1.271-2.632-1.956-4.266-1.825c-1.635,0.128-3.104,1.05-3.93,2.467
              c-5.896,10.117-9.013,21.688-9.013,33.461c0,16.035,5.725,31.249,15.838,43.137c-3.075-1.065-6.059-2.396-8.907-3.977
              c-1.529-0.851-3.395-0.838-4.914,0.033c-1.52,0.871-2.473,2.473-2.513,4.224c-0.007,0.295-0.007,0.59-0.007,0.889
              c0,23.935,12.882,45.484,32.577,57.229c-1.692-0.169-3.383-0.414-5.063-0.735c-1.732-0.331-3.513,0.276-4.681,1.597
              c-1.17,1.32-1.557,3.16-1.018,4.84c7.29,22.76,26.059,39.501,48.749,44.605c-18.819,11.787-40.34,17.961-62.932,17.961
              c-4.714,0-9.455-0.277-14.095-0.826c-2.305-0.274-4.509,1.087-5.294,3.279c-0.785,2.193,0.047,4.638,2.008,5.895
              c29.023,18.609,62.582,28.445,97.047,28.445c67.754,0,110.139-31.95,133.764-58.753c29.46-33.421,46.356-77.658,46.356-121.367
              c0-1.826-0.028-3.67-0.084-5.508c11.623-8.757,21.63-19.355,29.773-31.536c1.237-1.85,1.103-4.295-0.33-5.998
              C307.394,57.037,305.009,56.486,302.973,57.388z" />
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                </svg>
                                            </a>&nbsp;&nbsp;&nbsp;&nbsp;
                                            <a href='https://www.linkedin.com/company/amygb.ai/' target="_blank">
    
                                                <?xml version="1.0" encoding="iso-8859-1"?>
                                                <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                                                <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                                    xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                    viewBox="0 0 310 310" style="enable-background:new 0 0 310 310;"
                                                    xml:space="preserve" width='20' height='20' fill='#868686'>
                                                    <g id="XMLID_801_">
                                                        <path id="XMLID_802_" d="M72.16,99.73H9.927c-2.762,0-5,2.239-5,5v199.928c0,2.762,2.238,5,5,5H72.16c2.762,0,5-2.238,5-5V104.73
              C77.16,101.969,74.922,99.73,72.16,99.73z" />
                                                        <path id="XMLID_803_" d="M41.066,0.341C18.422,0.341,0,18.743,0,41.362C0,63.991,18.422,82.4,41.066,82.4
              c22.626,0,41.033-18.41,41.033-41.038C82.1,18.743,63.692,0.341,41.066,0.341z" />
                                                        <path id="XMLID_804_" d="M230.454,94.761c-24.995,0-43.472,10.745-54.679,22.954V104.73c0-2.761-2.238-5-5-5h-59.599
              c-2.762,0-5,2.239-5,5v199.928c0,2.762,2.238,5,5,5h62.097c2.762,0,5-2.238,5-5v-98.918c0-33.333,9.054-46.319,32.29-46.319
              c25.306,0,27.317,20.818,27.317,48.034v97.204c0,2.762,2.238,5,5,5H305c2.762,0,5-2.238,5-5V194.995
              C310,145.43,300.549,94.761,230.454,94.761z" />
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                </svg>
                                            </a>
    
    
    
    
                                        </p>
                                        <p>
                                            <span style="font-size:13px"><a href="https://www.amygb.ai/contact/"
                                                    target="_blank" style="color:#868686;text-decoration:underline;">Contact
                                                    Us</a></span>&nbsp;&nbsp;&nbsp;&nbsp;
                                            <span style="font-size:13px"><a href="https://www.amygb.ai/privacy-policy/"
                                                    target="_blank" style="color:#868686;text-decoration:underline;">Privacy
                                                    Policy</a></span>
    
                                        </p>
                                    </div>
                                </td>
    
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr style="background-color:#1a1a1a; color: white;">
                    <td style="font-size: 12px;padding:10px 30px; ">© 2022 AmyGB </td>
                </tr>
            </table>
        </div>
    </body>
    
    </html>`;
    return newMessage;
}
const REQUEST_STORAGE = (payload) => {
    const newMessage = `<!DOCTYPE html>
    <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
    
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <meta name="x-apple-disable-message-reformatting">
        <title></title>
        <style>
            table,
            td,
            div,
            h1,
            p {
                font-family: Arial, sans-serif;
            }
    
            @media screen and (max-width: 530px) {
                .col-lge {
                    max-width: 100% !important;
                }
            }
    
            @media screen and (min-width: 531px) {
                .col-sml {
                    max-width: 27% !important;
                }
    
                .col-lge {
                    max-width: 73% !important;
                }
            }
        </style>
    </head>
    
    <body style="margin:0;padding:0;word-spacing:normal;">
        <div role="article" aria-roledescription="email" lang="en"
            style="text-size-adjust:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background-color:white;">
            <table role="presentation" style="width:100%;border:none;border-spacing:0;">
                <tr>
                    <td>
                        <div style="position: relative;">
                            <?xml version="1.0" encoding="utf-8"?>
                            <!-- Generator: Adobe Illustrator 24.3.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                            <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="95" height="50"
                                viewBox="0 0 1920 1080" style="enable-background:new 0 0 1920 1080;" xml:space="preserve">
                                <style type="text/css">
                                    .st0 {
                                        fill: #111111;
                                    }
    
                                    .st1 {
                                        fill: #231F20;
                                    }
    
                                    .st2 {
                                        fill: #FFDE17;
                                    }
    
                                    .st3 {
                                        fill: #D6E541;
                                    }
    
                                    .st4 {
                                        fill: #00A14B;
                                    }
    
                                    .st5 {
                                        fill: none;
                                        stroke: #F7941D;
                                        stroke-width: 2;
                                        stroke-linecap: round;
                                        stroke-linejoin: round;
                                        stroke-miterlimit: 10;
                                    }
    
                                    .subheader {
                                        width: 100%;
                                        height: 100%;
                                        font-family: Tahoma;
                                        font-size: 17px;
                                        font-weight: normal;
                                        font-stretch: normal;
                                        font-style: normal;
                                        line-height: normal;
                                        letter-spacing: normal;
                                        text-align: left;
                                        color: white;
                                    }
    
    
                                    .st6 {
                                        fill: #F7941D;
                                    }
    
                                    .st7 {
                                        fill: #FFFFFF;
                                    }
    
                                    .st8 {
                                        fill: #DA1C5C;
                                    }
    
                                    .st9 {
                                        fill: #F4C914;
                                    }
                                </style>
                                <g>
                                    <circle class="st9" cx="372.1" cy="540" r="268.78" />
                                    <g>
                                        <path d="M365.01,654.1h-63.09c-8.67,0-16.36,5.56-19.08,13.79l-4.89,14.8c-2.72,8.23-10.41,13.79-19.08,13.79h-32.68
                  c-13.95,0-23.66-13.87-18.88-26.98l80.06-219.63c2.89-7.93,10.44-13.21,18.88-13.21h55.14c8.45,0,16,5.29,18.89,13.24
                  l79.75,219.63c4.76,13.11-4.95,26.96-18.89,26.96h-33.09c-8.67,0-16.36-5.56-19.08-13.79l-4.89-14.8
                  C381.37,659.66,373.68,654.1,365.01,654.1z M352.66,572.37L352.66,572.37c-6.12-18.36-32.11-18.31-38.16,0.08l0,0
                  c-4.28,13,5.41,26.38,19.09,26.38h0C347.31,598.82,357,585.38,352.66,572.37z" />
                                    </g>
                                    <g>
                                        <path d="M757.78,535.39c12.4,13.12,18.6,31.05,18.6,53.8v94.08c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45
                  v-86.09c0-9.22-2.57-16.39-7.69-21.52c-5.13-5.12-12.1-7.68-20.9-7.68c-8.82,0-15.78,2.56-20.91,7.68
                  c-5.13,5.13-7.68,12.3-7.68,21.52v86.09c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45v-86.09
                  c0-9.22-2.51-16.39-7.53-21.52c-5.02-5.12-11.94-7.68-20.75-7.68c-9.02,0-16.09,2.56-21.21,7.68c-5.13,5.13-7.69,12.3-7.69,21.52
                  v86.09c0,3.56-2.89,6.45-6.45,6.45H487.7c-3.56,0-6.45-2.89-6.45-6.45V523.7c0-3.56,2.89-6.45,6.45-6.45h47.36
                  c3.56,0,6.45,2.89,6.45,6.45v0.26c0,5.5,6.33,8.33,10.62,4.91c3.08-2.46,6.46-4.63,10.13-6.54c8.5-4.4,18.29-6.61,29.36-6.61
                  c12.71,0,24.03,2.77,33.97,8.3c7.45,4.15,13.72,9.57,18.82,16.26c2.41,3.16,7.27,3.24,9.83,0.19c5.31-6.32,11.7-11.65,19.16-15.99
                  c10.04-5.84,21.11-8.76,33.2-8.76C728.32,515.71,745.38,522.28,757.78,535.39z" />
                                        <path
                                            d="M991.09,526.24L887.19,767.9c-1.02,2.37-3.35,3.9-5.92,3.9H830.1c-4.7,0-7.82-4.87-5.86-9.14l35.79-77.72
                  c0.76-1.66,0.79-3.56,0.07-5.23l-65.73-153.47c-1.82-4.25,1.3-8.98,5.93-8.98h52.76c2.7,0,5.11,1.68,6.04,4.2l28.57,76.99
                  c2.09,5.64,10.08,5.59,12.11-0.07l27.55-76.85c0.92-2.56,3.35-4.27,6.07-4.27h51.77C989.8,517.25,992.92,521.99,991.09,526.24z" />
                                        <path d="M1152.4,544.3c-1.98,0-3.91-0.88-5.08-2.48c-3.29-4.54-7.51-8.12-12.65-10.74c-6.05-3.07-13.17-4.61-21.37-4.61
                  c-15.17,0-27.11,4.92-35.82,14.76c-8.71,9.84-13.06,23.06-13.06,39.66c0,18.65,4.66,32.85,13.99,42.58
                  c9.32,9.74,22.9,14.6,40.73,14.6c16.81,0,29.8-6.05,38.94-18.15c3.24-4.29,0.29-10.44-5.09-10.44h-42.78
                  c-3.56,0-6.45-2.89-6.45-6.45v-30.45c0-3.56,2.89-6.45,6.45-6.45h99.62c3.56,0,6.45,2.89,6.45,6.45v50.6
                  c0,0.9-0.17,1.79-0.52,2.62c-4.7,11.01-11.44,21.35-20.23,31.03c-9.12,10.04-20.65,18.29-34.58,24.75
                  c-13.94,6.46-29.82,9.68-47.65,9.68c-21.72,0-40.94-4.66-57.64-13.99c-16.71-9.32-29.62-22.33-38.74-39.04
                  c-9.12-16.7-13.68-35.81-13.68-57.33c0-21.31,4.56-40.32,13.68-57.03c9.12-16.7,21.98-29.71,38.58-39.04
                  c16.6-9.32,35.76-13.99,57.49-13.99c27.26,0,49.8,6.56,67.63,19.67c15.65,11.52,26.09,26.75,31.32,45.69
                  c1.13,4.08-2.02,8.11-6.25,8.11H1152.4z" />
                                        <path d="M1411.96,597.33c7.48,9.74,11.22,20.86,11.22,33.36c0,18.45-6.35,32.89-19.06,43.35c-12.71,10.45-30.54,15.68-53.49,15.68
                  h-100.84c-3.56,0-6.45-2.89-6.45-6.45V479.43c0-3.56,2.89-6.45,6.45-6.45h97.46c22.13,0,39.5,4.92,52.11,14.76
                  c12.6,9.84,18.91,23.67,18.91,41.5c0,12.71-3.33,23.32-9.99,31.82c-3.64,4.64-7.93,8.48-12.88,11.5c-4.1,2.51-3.95,8.72,0.3,10.98
                  C1402.06,586.9,1407.48,591.5,1411.96,597.33z M1303.6,552.61c0,3.56,2.89,6.45,6.45,6.45h23.99c15.16,0,22.75-6.25,22.75-18.75
                  c0-12.91-7.59-19.37-22.75-19.37h-23.99c-3.56,0-6.45,2.89-6.45,6.45V552.61z M1361.39,622.08c0-6.56-2-11.58-5.99-15.06
                  c-4-3.48-9.69-5.23-17.06-5.23h-28.29c-3.56,0-6.45,2.89-6.45,6.45v26.46c0,3.56,2.89,6.45,6.45,6.45h28.6
                  C1353.81,641.14,1361.39,634.79,1361.39,622.08z" />
                                        <path d="M1453.15,683.41c-6.46-5.84-9.68-13.27-9.68-22.29c0-9.01,3.23-16.49,9.68-22.44c6.46-5.94,15.01-8.91,25.67-8.91
                  c10.45,0,18.9,2.97,25.36,8.91c6.46,5.95,9.68,13.43,9.68,22.44c0,8.82-3.23,16.19-9.68,22.14c-6.46,5.95-14.91,8.91-25.36,8.91
                  C1468.16,692.17,1459.61,689.25,1453.15,683.41z" />
                                        <path d="M1542,556.6c6.45-13.32,15.26-23.57,26.44-30.74c11.17-7.17,23.62-10.76,37.35-10.76c11.88,0,22.13,2.36,30.74,7.07
                  c3.39,1.86,6.48,3.97,9.26,6.33c4.24,3.6,10.72,0.76,10.72-4.8v0c0-3.56,2.89-6.45,6.45-6.45h47.36c3.56,0,6.45,2.89,6.45,6.45
                  v159.57c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45v-0.05c0-5.55-6.46-8.4-10.7-4.82
                  c-2.83,2.39-5.98,4.52-9.44,6.4c-8.71,4.72-18.91,7.07-30.59,7.07c-13.74,0-26.18-3.58-37.35-10.76
                  c-11.17-7.17-19.98-17.47-26.44-30.9c-6.46-13.42-9.69-29.05-9.69-46.88C1532.31,585.5,1535.54,569.93,1542,556.6z M1647.44,577.2
                  c-6.05-6.35-13.48-9.53-22.29-9.53c-9.02,0-16.5,3.13-22.44,9.38c-5.95,6.25-8.91,15.02-8.91,26.28c0,11.07,2.97,19.83,8.91,26.29
                  c7.56,8.21,17.6,11.2,30.14,8.97c0.47-0.08,0.96-0.22,1.41-0.39c14.81-5.57,22.25-17.2,22.25-34.87
                  C1656.51,592.26,1653.49,583.55,1647.44,577.2z" />
                                        <path class="st9" d="M1755.96,492.5c-6.46-5.84-9.69-13.17-9.69-21.98c0-9.02,3.23-16.5,9.69-22.44
                  c6.45-5.94,15.01-8.91,25.67-8.91c10.45,0,18.91,2.97,25.36,8.91c6.45,5.95,9.68,13.43,9.68,22.44c0,8.81-3.23,16.14-9.68,21.98
                  c-6.46,5.84-14.91,8.76-25.36,8.76C1770.97,501.26,1762.42,498.35,1755.96,492.5z" />
                                        <path d="M1811.45,523.7v159.57c0,3.56-2.89,6.45-6.45,6.45h-47.36c-3.56,0-6.45-2.89-6.45-6.45V523.7c0-3.56,2.89-6.45,6.45-6.45
                  H1805C1808.56,517.25,1811.45,520.14,1811.45,523.7z" />
                                    </g>
                                </g>
                            </svg>
                            <div style="float: right;
      width: 95px;
      height: 50px;
      position: absolute;
      top: 25%;
      right: 2%;">
                                <img style="width: 100%"
                                    src='https://amygb-web-static.s3.ap-south-1.amazonaws.com/visionLogo.png' />
    
                            </div>
                        </div>
    
                    </td>
    
                </tr>
                <tr>
                    <td align="center" style="padding:0;">
                        <table role="presentation"
                            style="width:100%;border:none;border-spacing:0;text-align:left;font-family:Arial,sans-serif;font-size:16px;line-height:22px;">
                            <tr>
                                <td
                                    style="padding:50px 30px 50px 30px;text-align:center;font-size:24px;font-weight:bold;background-color: black;">
                                    <div class="hello" style="font-family: Tahoma;
                      font-weight: 800;
                      font-stretch: normal;
                      font-size:26px;
                      font-style: normal;
                      line-height: normal;
                      letter-spacing: normal;
                      text-align: left;
                      font-family: Tahoma;
                      color: white;">
                                        <span class="text-style-1" style="color: white;">Hello </span><span
                                            style="color: #f4c914;">${payload.firstName || payload.lastName},</span>
                                        <br />
                                        <span class="subheader" style="font-weight: bold;">
                                            We have received your request for Quota Increase.                                    </span>
                                    </div>
                                    <div class="subheader" style="width: 100%;
              height: 100%;
              font-family: Tahoma;
              font-weight: normal;
              font-stretch: normal;
              font-style: normal;
              line-height: normal;
              letter-spacing: normal;
              text-align: left;
              margin-top: 1vh;
              color: white;">
                                    </div>
                                </td>
                            </tr>
    
    
                            <tr>
                                <td style="padding:30px;background-color:#f2f2f2;">
                                    <h1
                                        style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: normal;">
                                        Your request for increasing the Quota for your Trial account is in consideration. We will
                                        send a response to your registered email address within 2 business days.
    
                                        <br />
                                       
    
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:35px 30px 0 30px;font-size:0;background-color:#ffffff;">
    
                                    <div class="col-lge"
                                        style="display:inline-block;width:100%;max-width:395px;vertical-align:top;padding-bottom:20px;font-family:Arial,sans-serif;font-size:16px;line-height:22px;color:#5e5e5e;">
    
    
    
    
                                        <h1
                                            style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: normal;">
    
                                            In order to reap maximum benefits from your Visionera free trial, we recommend a
                                            <a href="http://scheduler.amygb.ai/" target="_blank">quick call</a> with our
                                            Product
                                            experts to understand your specific requirements and guide you on best practices
                                            designed to help you
                                            achieve your goals faster.
                                        </h1>
                                        <br />
                                        <div
                                            style="margin-top:0;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: 500;color: black;">
                                            Regards,
                                        </div>
                                        <div
                                            style="margin-top:0;margin-bottom:16px;font-size:16px;line-height:1.67;letter-spacing:-0.02em;font-weight: 500;">
                                            Team VisionERA
                                        </div>
                                        <br />
                                        <br />
                                        <p
                                            style="border-bottom: solid 1px lightGray;padding-bottom: 20px;margin-bottom: 20px;">
                                            <a href='https://www.facebook.com/amygb.agb/' target="_blank"
                                                style="text-decoration: none">
                                                <?xml version="1.0" encoding="iso-8859-1"?>
                                                <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                                                <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                                    xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                    viewBox="0 0 310 310" style="enable-background:new 0 0 310 310;"
                                                    xml:space="preserve" width="20" height="20" fill='#868686'>
                                                    <g id="XMLID_834_">
                                                        <path id="XMLID_835_" d="M81.703,165.106h33.981V305c0,2.762,2.238,5,5,5h57.616c2.762,0,5-2.238,5-5V165.765h39.064
              c2.54,0,4.677-1.906,4.967-4.429l5.933-51.502c0.163-1.417-0.286-2.836-1.234-3.899c-0.949-1.064-2.307-1.673-3.732-1.673h-44.996
              V71.978c0-9.732,5.24-14.667,15.576-14.667c1.473,0,29.42,0,29.42,0c2.762,0,5-2.239,5-5V5.037c0-2.762-2.238-5-5-5h-40.545
              C187.467,0.023,186.832,0,185.896,0c-7.035,0-31.488,1.381-50.804,19.151c-21.402,19.692-18.427,43.27-17.716,47.358v37.752H81.703
              c-2.762,0-5,2.238-5,5v50.844C76.703,162.867,78.941,165.106,81.703,165.106z" />
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                </svg>
                                            </a>&nbsp;&nbsp;&nbsp;&nbsp;
                                            <a href='https://twitter.com/AmyGB_ai' target="_blank"
                                                style="text-decoration: none">
                                                <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                                                <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                                    xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                    viewBox="0 0 310 310" style="enable-background:new 0 0 310 310;"
                                                    xml:space="preserve" width='20' height='20' fill='#868686'>
                                                    <g id="XMLID_826_">
                                                        <path id="XMLID_827_" d="M302.973,57.388c-4.87,2.16-9.877,3.983-14.993,5.463c6.057-6.85,10.675-14.91,13.494-23.73
              c0.632-1.977-0.023-4.141-1.648-5.434c-1.623-1.294-3.878-1.449-5.665-0.39c-10.865,6.444-22.587,11.075-34.878,13.783
              c-12.381-12.098-29.197-18.983-46.581-18.983c-36.695,0-66.549,29.853-66.549,66.547c0,2.89,0.183,5.764,0.545,8.598
              C101.163,99.244,58.83,76.863,29.76,41.204c-1.036-1.271-2.632-1.956-4.266-1.825c-1.635,0.128-3.104,1.05-3.93,2.467
              c-5.896,10.117-9.013,21.688-9.013,33.461c0,16.035,5.725,31.249,15.838,43.137c-3.075-1.065-6.059-2.396-8.907-3.977
              c-1.529-0.851-3.395-0.838-4.914,0.033c-1.52,0.871-2.473,2.473-2.513,4.224c-0.007,0.295-0.007,0.59-0.007,0.889
              c0,23.935,12.882,45.484,32.577,57.229c-1.692-0.169-3.383-0.414-5.063-0.735c-1.732-0.331-3.513,0.276-4.681,1.597
              c-1.17,1.32-1.557,3.16-1.018,4.84c7.29,22.76,26.059,39.501,48.749,44.605c-18.819,11.787-40.34,17.961-62.932,17.961
              c-4.714,0-9.455-0.277-14.095-0.826c-2.305-0.274-4.509,1.087-5.294,3.279c-0.785,2.193,0.047,4.638,2.008,5.895
              c29.023,18.609,62.582,28.445,97.047,28.445c67.754,0,110.139-31.95,133.764-58.753c29.46-33.421,46.356-77.658,46.356-121.367
              c0-1.826-0.028-3.67-0.084-5.508c11.623-8.757,21.63-19.355,29.773-31.536c1.237-1.85,1.103-4.295-0.33-5.998
              C307.394,57.037,305.009,56.486,302.973,57.388z" />
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                </svg>
                                            </a>&nbsp;&nbsp;&nbsp;&nbsp;
                                            <a href='https://www.linkedin.com/company/amygb.ai/' target="_blank">
    
                                                <?xml version="1.0" encoding="iso-8859-1"?>
                                                <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                                                <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                                                    xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                    viewBox="0 0 310 310" style="enable-background:new 0 0 310 310;"
                                                    xml:space="preserve" width='20' height='20' fill='#868686'>
                                                    <g id="XMLID_801_">
                                                        <path id="XMLID_802_" d="M72.16,99.73H9.927c-2.762,0-5,2.239-5,5v199.928c0,2.762,2.238,5,5,5H72.16c2.762,0,5-2.238,5-5V104.73
              C77.16,101.969,74.922,99.73,72.16,99.73z" />
                                                        <path id="XMLID_803_" d="M41.066,0.341C18.422,0.341,0,18.743,0,41.362C0,63.991,18.422,82.4,41.066,82.4
              c22.626,0,41.033-18.41,41.033-41.038C82.1,18.743,63.692,0.341,41.066,0.341z" />
                                                        <path id="XMLID_804_" d="M230.454,94.761c-24.995,0-43.472,10.745-54.679,22.954V104.73c0-2.761-2.238-5-5-5h-59.599
              c-2.762,0-5,2.239-5,5v199.928c0,2.762,2.238,5,5,5h62.097c2.762,0,5-2.238,5-5v-98.918c0-33.333,9.054-46.319,32.29-46.319
              c25.306,0,27.317,20.818,27.317,48.034v97.204c0,2.762,2.238,5,5,5H305c2.762,0,5-2.238,5-5V194.995
              C310,145.43,300.549,94.761,230.454,94.761z" />
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                    <g>
                                                    </g>
                                                </svg>
                                            </a>
    
    
    
    
                                        </p>
                                        <p>
                                            <span style="font-size:13px"><a href="https://www.amygb.ai/contact/"
                                                    target="_blank" style="color:#868686;text-decoration:underline;">Contact
                                                    Us</a></span>&nbsp;&nbsp;&nbsp;&nbsp;
                                            <span style="font-size:13px"><a href="https://www.amygb.ai/privacy-policy/"
                                                    target="_blank" style="color:#868686;text-decoration:underline;">Privacy
                                                    Policy</a></span>
    
                                        </p>
                                    </div>
                                </td>
    
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr style="background-color:#1a1a1a; color: white;">
                    <td style="font-size: 12px;padding:10px 30px; ">© 2022 AmyGB </td>
                </tr>
            </table>
        </div>
    </body>
    
    </html>`;
    return newMessage;
}
module.exports = {
    APPROVE_CUSTOMER_TEMPLATE,
    SIGNUP_TEMPLATE,
    APPROVE_EXTENSION,
    APPROVE_STORAGE,
    REQUEST_EXTENSION,
    REQUEST_STORAGE
};
