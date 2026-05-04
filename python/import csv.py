## https://codereview.stackexchange.com/questions/180320/convert-all-csv-files-in-a-given-directory-to-json-using-python

import csv
import json
import glob
import os

for filename in glob.glob('/Users/emiliolari/Desktop/School/MFA DT/Fall_2021/Thesis_1/Data/Flight radar data/20210830_positions/*.csv'):
    csvfile = os.path.splitext(filename)[0]
    jsonfile = csvfile + '.json'

    with open(csvfile+'.csv') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    with open(jsonfile, 'w') as f:
        json.dump(rows, f)