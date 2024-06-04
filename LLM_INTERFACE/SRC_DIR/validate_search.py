import createJsonFeats as cj
from scipy.spatial import distance

#a, b = cj.returnEmbed(""), cj.returnEmbed("")
a, b = cj.returnEmbed('''Based on the table, it appears to be a report or dataset with various columns. Here are some possible purposes: 1. **Financial Report**: The table could be a financial report, with columns for input values (e.g., STR), calculations (e.g., INC, DEC), and output values (e.g., OUT). The rows might represent different accounts, transactions, or periods. 2. **Data Analysis**: The table might be a dataset for data analysis, where each row represents a single observation or sample, and the columns contain measured variables or features. The "None" values could indicate missing data. 3. **Geographic Mapping**: The column names like "TRIANGULATION" and "header" suggest a geographic or mapping-related purpose. The table might be used to draw boundaries, create maps, or perform spatial analysis. 4. **Database Backup**: The table could be a backup or extract of a larger database, containing specific columns and values. The "None" values might indicate that certain fields are not populated. 5. **Log File**: The table might be a log file or a record of events, with each row representing a specific event or transaction. The columns could contain metadata about the events, such as timestamps, IDs, and status information. Without more context or information about the table's origin and purpose, it's difficult to pinpoint a specific purpose. If you have more details or context, I may be able to provide a more accurate answer.'''), cj.returnEmbed("What are the reports that are associated with time trials for table detection and accuracy")

print( distance.cosine( a, b ) )