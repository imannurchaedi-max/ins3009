import pandas as pd
import numpy as np

input_path = r'c:\Users\imann\SynologyDrive\0. APP SCRIPT\0. MK EMP TRACKER\EMPLOYEE DATA.xlsx'
output_path = r'c:\Users\imann\SynologyDrive\0. APP SCRIPT\0. MK EMP TRACKER\EMPLOYEE DATA_CLEANED.xlsx'

try:
    print(f"Loading Excel file: {input_path}")
    excel_data = pd.ExcelFile(input_path)
    
    # We will store cleaned dataframes here to write them back to a new Excel file
    cleaned_sheets = {}
    
    for sheet in excel_data.sheet_names:
        print(f"\nCleaning Tab: '{sheet}'...")
        df = pd.read_excel(excel_data, sheet_name=sheet)
        
        if df.empty:
            print(f"  - '{sheet}' is empty. Skipping.")
            continue
            
        initial_shape = df.shape
        
        # 1. Drop completely empty rows and columns
        df.dropna(how='all', inplace=True)
        df.dropna(how='all', axis=1, inplace=True)
        
        # 2. Trim whitespaces for all string columns
        str_cols = df.select_dtypes(include=['object', 'string']).columns
        for col in str_cols:
            df[col] = df[col].apply(lambda x: x.strip() if isinstance(x, str) else x)
            
        # Specific fixes for Sheet5 (Main Database)
        if sheet == 'Sheet5':
            # Remove rows where NIK and Nama are both missing (likely ghost rows)
            if 'NIK' in df.columns and 'Nama (sesuai KTP)' in df.columns:
                df.dropna(subset=['NIK', 'Nama (sesuai KTP)'], how='all', inplace=True)
                
            # Remove duplicate NIKs (keep the first occurrence)
            if 'NIK' in df.columns:
                duplicates_before = df.duplicated(subset=['NIK'], keep=False).sum()
                df.drop_duplicates(subset=['NIK'], keep='first', inplace=True)
                if duplicates_before > 0:
                    print(f"  - Removed NIK duplicates.")
            
            # Fill missing values for important columns
            important_cols = ['NO KTP', 'Sourcing Via', 'Usia', 'Jenis Kelamin', 'Bagian', 'Group', 'DEPT', 'Jabatan']
            for col in important_cols:
                if col in df.columns:
                    df[col] = df[col].fillna("TIDAK_ADA_DATA")
            
            # Drop Unnamed columns that are mostly empty (e.g. > 90% missing)
            unnamed_cols = [col for col in df.columns if str(col).startswith('Unnamed:')]
            for col in unnamed_cols:
                if df[col].isnull().sum() / len(df) > 0.9:
                    df.drop(columns=[col], inplace=True)
                    print(f"  - Dropped mostly empty column: {col}")

        # Specific fixes for Sheet7
        elif sheet == 'Sheet7':
            cols_to_fill = [' Masa Kerja', ' Departmen', ' Section', ' Jabatan']
            for col in cols_to_fill:
                if col in df.columns:
                    df[col] = df[col].fillna("TIDAK_ADA_DATA")
                    
        # Store the cleaned dataframe
        cleaned_sheets[sheet] = df
        
        final_shape = df.shape
        print(f"  - Shape changed from {initial_shape} to {final_shape}")

    # Write all cleaned sheets to a new Excel file
    print(f"\nWriting cleaned data to: {output_path}")
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        for sheet_name, cleaned_df in cleaned_sheets.items():
            cleaned_df.to_excel(writer, sheet_name=sheet_name, index=False)
            
    print("\nData cleaning completed successfully! Saved to 'EMPLOYEE DATA_CLEANED.xlsx'")

except Exception as e:
    print(f"An error occurred during cleaning: {e}")
