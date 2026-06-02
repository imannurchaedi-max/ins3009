import json
import urllib.request
import urllib.error

# Load the token
with open(r"C:\Users\imann\.clasprc.json", "r") as f:
    clasprc = json.load(f)

access_token = clasprc["tokens"]["default"]["access_token"]

spreadsheet_id = "1jTsZixaANJd8Ijs3f66LwbXSBC9UcRoALLolEvxiz40"
range_name = "CONFIG_MODUL!A1:B4"

url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{range_name}?valueInputOption=USER_ENTERED"

data = {
  "range": range_name,
  "majorDimension": "ROWS",
  "values": [
    ["NAMA_MODUL", "LINK_MODUL"],
    ["GATE_PABRIK", "https://script.google.com/macros/s/AKfycbx6ssFoO_2k9c3L4GPIux0k_75HjJK2oYm-lnlG9n9J0uCTIbEgx7JSodA3eLPMvU2yUw/exec"],
    ["AREA_KERJA", "https://script.google.com/macros/s/AKfycbzO-B9MbDEiTH6SQVnX207gMpA_f88WMjb6-jk6lB8w6yHC5jIgIjM4oBAXn-rIdoCKwg/exec"],
    ["REPORT", "https://script.google.com/macros/s/AKfycbyYTUFVC3K-W5HKNvmrFfx8_XwNlefUK0_26g8_XDQBkRRBk7V5inRYUZXtySgCbA2r/exec"]
  ]
}

req = urllib.request.Request(url, method="PUT")
req.add_header("Authorization", f"Bearer {access_token}")
req.add_header("Content-Type", "application/json")

try:
    with urllib.request.urlopen(req, data=json.dumps(data).encode("utf-8")) as response:
        result = response.read()
        print("Success!")
        print(result.decode("utf-8"))
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    print(e.read().decode("utf-8"))
except Exception as e:
    print(f"Error: {e}")
