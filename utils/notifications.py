'''
this file , for now, will contain methods to send out notifications.
Only defining the email channel for now but will need to integrate slack, discord and other channels
'''
import smtplib, subprocess
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

def sendEmail( recipient_list, subject, body ):

    print('INCOMING -> recipient_list, subject, body = ', recipient_list,'\n',subject,'\n',body)
    message = MIMEMultipart()
    message["From"] = "vikram.murthy@gmail.com"
    message["To"] = None ## update in the loop using recipient_list
    message["Subject"] = subject
    message.attach(MIMEText(body, "plain"))

    try:
        for recipient_ in recipient_list:
            message["To"] = recipient_
            # Use sendmail command to send email
            sendmail_location = "/usr/sbin/sendmail"  # Sendmail location on Ubuntu
            p = subprocess.Popen([sendmail_location, "-t"], stdin=subprocess.PIPE, stdout=subprocess.PIPE)

            p.communicate(message.as_bytes())
            print("Email sent successfully!")
    except Exception as e:
        print(f"Error sending email: {e}")    
