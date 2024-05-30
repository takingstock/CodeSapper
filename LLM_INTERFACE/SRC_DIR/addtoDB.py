import createJsonFeats # returnEmbed
import os, json, sys, traceback, db_utils

with open( 'SpreadSheetSummary.json', 'r' ) as fp:
    js_ = json.load( fp )

cnt_ = 0

def addToDB():
    for fnm, sheets in js_.items():
        for sheetname, txt in sheets.items():
            cnt_ += 1
            emb_ = createJsonFeats.returnEmbed( txt )
            dd_ = { 'text': txt, 'docSignature': emb_, 'docID': cnt_ }

            db_utils.insertNewSignature( dd_ )

if __name__ == "__main__":
    addToDB()
