import sys
import numpy as np
# import generate_test_data as GTD

def returnNumCaps( arr_ ):
  numCaps = 0
  for elem in arr_:
    for char in elem:
      if ord(char) >= 65 and ord(char) <= 90: numCaps += 1
  return numCaps

def returnNumWords( arr_ ):
  numWds = 0
  for elem in arr_:
    for char in elem:
      if ( ord(char) >= 65 and ord(char) <= 90 ) or \
                        ( ord(char) >= 97 and ord(char) <= 122 ): numWds += 1
  return numWds

def returnNumDigits( arr_ ):
  numDigits = 0
  for elem in arr_:
    for char in elem:
      if ( ord(char) >= 48 and ord(char) <= 57 ): numDigits += 1
  return numDigits

def returnAvgLenWords( arr_ ):
  avgLen = []
  for elem in arr_:
    try:
      if int(elem) >= 0: continue
    except:
      avgLen.append( len(elem) )
  if len( avgLen ) > 0: return np.mean( avgLen )
  return 0

def returnHeaderRowBreak( relevant_ ):
  '''
  the idea here is simple; we take a feature vector for every row and simply watch out for the row
  that has numerical values in it ..no matter how many rows are present in the header of a table, it 
  will VERY rarely have numbers in them..so we take pairs and wherever the distance between 2 pairs
  drops steeply, we know that MOST LIKELY the table header ends at that row
  '''
  begin = False
  # min_max_y_flag = True

  #print( relevant_ )
  feat_arr = []
  min_y = []
  max_y = []

  for elem in relevant_:
    collect_ = []
    maxNumWords = 0
    min_y_here = 100000
    max_y_here = 0
    for inn in elem:
      collect_.append( inn['text'] )
      num_words = len( inn['text'].split() )
      pts = inn['pts']
      min_y_here = min(pts[1], min_y_here)
      max_y_here = max(pts[3], max_y_here)
      if num_words > maxNumWords:
        maxNumWords = num_words

    min_y.append(min_y_here)
    max_y.append(max_y_here)
    a, b,c, d = returnNumCaps( collect_ ), returnNumWords( collect_ ),\
                  returnNumDigits( collect_ ), returnAvgLenWords( collect_ )
    if c > 0:
      ## if digit, has to be a non header , so make it distinct ..add weights\
      ## to make it so ..adding max number of words per cell as another imp feature
      ## to diff between 
      a, b,c, d, e = a*0.01, b*0.01, c, d*0.01, maxNumWords

    #print('mad->', collect_, [ a, b, c, d, maxNumWords ] )
    feat_arr.append( [ a, b, c, d, maxNumWords ] )

  print("feat_arr : ", feat_arr)
    
  ## test
  #feat_arr.insert( 1, [ 0, 15, 0, 5 ] )

  from scipy import spatial

  print("min_y, max_y : ", min_y, max_y)

  for ctr in range(len(feat_arr)-1):
    max_present, min_next = max_y[ctr], min_y[ctr + 1]
    print("max_present, min_next : ", max_present, min_next)
    if (((min_next - max_present) < -10) and True):
      feat_arr[ctr + 1] = feat_arr[ctr]
      continue
    curr_row, next_row = feat_arr[ ctr ], feat_arr[ ctr+1 ]
    print("curr_row, next_row : ", curr_row, next_row)

    similarity_ = 1 - spatial.distance.cosine( curr_row, next_row )
    print( 'The similarity between row ',ctr,' & ',ctr+1,' is = ',\
     similarity_ )

    if similarity_ < 0.2:
      print('Column header breaks at row->', ctr)
      return ctr

  return 0

#print( returnHeaderRowBreak( GTD.get_test_feats( sys.argv[1] ) ) )
