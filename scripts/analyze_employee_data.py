import pandas as pd
import numpy as np
import re

file_path = r'c:\Users\imann\SynologyDrive\0. APP SCRIPT\0. MK EMP TRACKER\EMPLOYEE DATA.xlsx'

try:
    print(f"Loading Excel file: {file_path}")
    excel_data = pd.ExcelFile(file_path)
    sheet_names = excel_data.sheet_names
    print(f"Found {len(sheet_names)} sheets: {sheet_names}\n")

    for sheet in sheet_names:
        print(f"==================================================")
        print(f"Analyzing Tab: '{sheet}'")
        print(f"==================================================")
        
        df = pd.read_excel(excel_data, sheet_name=sheet)
        
        print(f"Shape: {df.shape[0]} rows, {df.shape[1]} columns")
        
        if df.empty:
            print("Status: EMPTY SHEET")
            continue
            
        print(f"\nColumns: {list(df.columns)}")
        
        # Check missing values
        missing_info = df.isnull().sum()
        missing_cols = missing_info[missing_info > 0]
        if missing_cols.empty:
            print("\nMissing Values: NONE (Perfect!)")
        else:
            print("\nMissing Values:")
            for col, count in missing_cols.items():
                print(f"  - {col}: {count} missing ({count/len(df)*100:.2f}%)")
                
        # Check for duplicates
        duplicates = df.duplicated().sum()
        print(f"\nDuplicate Rows: {duplicates}")
        
        # Check string columns for trailing/leading spaces
        str_cols = df.select_dtypes(include=['object']).columns
        space_issues = {}
        for col in str_cols:
            # Check for leading/trailing whitespaces in non-null strings
            mask = df[col].dropna().astype(str).str.contains(r'^\s+|\s+$', regex=True)
            if mask.sum() > 0:
                space_issues[col] = mask.sum()
                
        if space_issues:
            print("\nWhitespace Issues (Leading/Trailing spaces):")
            for col, count in space_issues.items():
                print(f"  - {col}: {count} rows")
        else:
            print("\nWhitespace Issues: NONE (Perfect!)")
            
        # Specific Checks (Assuming typical employee data columns like NIK, Email, Name)
        print("\n--- Specific Data Integrity Checks ---")
        
        # Check NIK/ID uniqueness (Look for columns containing 'NIK', 'ID', 'KARYAWAN')
        id_cols = [c for c in df.columns if 'nik' in str(c).lower() or 'id' == str(c).lower()]
        for id_col in id_cols:
            dupe_ids = df[id_col].duplicated(keep=False).sum()
            print(f"Column '{id_col}' - Duplicates found: {dupe_ids}")
            
        # Check Email validity
        email_cols = [c for c in df.columns if 'email' in str(c).lower()]
        for email_col in email_cols:
            valid_email_pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
            non_null_emails = df[email_col].dropna().astype(str)
            invalid_emails = non_null_emails[~non_null_emails.str.match(valid_email_pattern)]
            if len(invalid_emails) > 0:
                print(f"Column '{email_col}' - Invalid format emails found: {len(invalid_emails)}")
                # Show up to 5 examples
                print(f"  Examples: {invalid_emails.head(5).tolist()}")
            else:
                print(f"Column '{email_col}' - All emails well-formatted.")
                
        print("\n")

except Exception as e:
    print(f"An error occurred: {e}")
