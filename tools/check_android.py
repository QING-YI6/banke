from lxml import etree
import glob
import json

xml_files = glob.glob("android/app/src/main/res/**/*.xml", recursive=True)
xml_files.append("android/app/src/main/AndroidManifest.xml")
for f in xml_files:
    etree.parse(f)
print("xml files", len(xml_files))

cfg = json.load(open("android/app/src/main/assets/capacitor.config.json", encoding="utf-8"))
print("appName", cfg["appName"].encode("unicode_escape"))
print("appId", cfg["appId"])

defs = 0
for f in xml_files:
    text = open(f, encoding="utf-8").read()
    if 'name="ic_launcher_background"' in text:
        defs += 1
        print("bg definition in", f)
print("bg definitions", defs)
