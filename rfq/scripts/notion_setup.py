"""Create the "Revalx RFQs" database under a parent page that the Revalx integration has been shared with.
Usage: with-secrets.sh sh -c 'NOTION_TOKEN=$NOTION_REVALX_TOKEN python rfq/scripts/notion_setup.py <parent_page_id>'
Prints the database id (not a secret)."""
import os, sys
import httpx

TOKEN, PARENT = os.environ["NOTION_TOKEN"], sys.argv[1]
text = {"rich_text": {}}
props = {
    "Enquiry ID": {"title": {}}, "Date": {"date": {}},
    "Source": {"select": {"options": [{"name": "website"}]}},
    "Language": {"select": {"options": [{"name": x} for x in ("en", "de", "es", "fr")]}},
    "Owner": text,
    "Stage": {"select": {"options": [{"name": n} for n in ("New", "In review", "Supplier quotes", "Quoted", "Won", "Lost", "Disqualified")]}},
    "Customer": text, "Company": text, "Country": text, "Email": {"email": {}}, "Phone": {"phone_number": {}},
    "Product type": {"select": {"options": [{"name": n} for n in ("Ball", "Butterfly", "Gate", "Check", "Not sure")]}},
    "Size": text, "Quantity": text, "Application": text, "Destination": text, "Delivery date": text,
    "Need": text, "Technical details": text, "Files": {"number": {}},
    "Technical status": {"select": {"options": [{"name": n} for n in ("Incomplete", "Complete", "Needs clarification")]}},
    "Suppliers contacted": text, "Supplier cost": {"number": {}}, "Selling price": {"number": {}}, "Expected margin": {"number": {}},
    "Quotation date": {"date": {}}, "Quotation validity": {"date": {}}, "Follow-up date": {"date": {}},
    "Outcome": {"select": {"options": [{"name": n} for n in ("Pending", "Won", "Lost", "Disqualified")]}}, "Outcome reason": text,
}
r = httpx.post("https://api.notion.com/v1/databases", headers={"Authorization": f"Bearer {TOKEN}", "Notion-Version": "2022-06-28"},
               json={"parent": {"type": "page_id", "page_id": PARENT}, "title": [{"text": {"content": "Revalx RFQs"}}], "properties": props}, timeout=30)
r.raise_for_status()
print("database id:", r.json()["id"])
