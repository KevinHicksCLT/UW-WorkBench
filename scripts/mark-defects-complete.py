"""Mark defect-tracker rows Complete (col B). CF auto-applies the green fill.
Usage: python scripts/mark-defects-complete.py VS-01 T-01 ...
"""
import sys, openpyxl

PATH = r'documents/Transformation-Bridge-Defect-Tracker-v5.xlsx'

def main(ids):
    ids = set(ids)
    wb = openpyxl.load_workbook(PATH)
    ws = wb['Defect Tracker']
    done = []
    for r in range(5, ws.max_row + 1):
        v = ws.cell(r, 1).value
        if v in ids:
            ws.cell(r, 2).value = 'Complete'
            done.append(v)
    wb.save(PATH)
    print('Marked Complete:', ', '.join(sorted(done)))
    missing = ids - set(done)
    if missing:
        print('NOT FOUND:', ', '.join(sorted(missing)))

if __name__ == '__main__':
    main(sys.argv[1:])
