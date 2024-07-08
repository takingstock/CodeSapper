import os, json, cv2, traceback
import numpy as np
from collections import Counter
from fuzzywuzzy import fuzz

main_hdr_anchor_ = ["desc", "particular", "perticuler", "product", "item", "destri", "equipment" ]
bkp_hdr_anchor_ = ["reference", "material", "service", "charge", "destri", 'equipment', 'date', 'document', "details", 'price']

qty_ = [ 'qty', 'shipped', 'shp', "units", "unit", "oty", "qtv", "qly", "iqty", "quanti", "qtyunit", 'quanti','charge', 'piece' ]
amt_ = [ 'amt', 'extension', 'anaunt', 'extended', 'annt', 'total', 'value', "armpunt", "amaunt", 'amount',\
         'price', 'total' ]

def chkNum( wd_, INV_IN_VICINITY=False, invoice_only_chk=None, mode='NA' ):
        ## check if NUM , if yes return VAL
        if '/1nvoice' in wd_.lower(): return None
        if '(' in wd_ and ')' in wd_ and '-' in wd_:
          print( 'PHONE !', wd_)
          return None
        wd_ = (wd_.split(':')[-1])
        if invoice_only_chk is not None and INV_IN_VICINITY is False:
          wd_ = (wd_.split('.')[-1])
          print('GOLOPIN->',wd_)
        wd_ = wd_.replace(' ','')
        special_char, alpha_, digs_, num, small, first_occur = 0, 0, 0, '', 0, 10000
        for charctr in range( len(wd_) ):
                char = wd_[ charctr ]  
                #if ord( char ) >= 48 and ord( char ) <= 57 or char == ',' or char == '.':
                if ord( char ) >= 48 and ord( char ) <= 57: ## BREAKING CHANGE
                        digs_ += 1
                        num += char
                        first_occur = charctr 
                elif ord( char ) >= 65 and ord( char ) <= 90: alpha_ += 1
                elif char in [ '-', '/' ]: alpha_ += 1
                elif ord( char ) >= 97 and ord( char ) <= 122: small += 1
                else: special_char += 1

        #print('Evaluating->', wd_, digs_, alpha_, special_char, len(wd_), INV_IN_VICINITY )
        #print('HUMBLE->', wd_, alpha_, digs_, first_occur, len(wd_) - 1, mode )

        ## sometimes header elements MIGHT have 1 digit at the begin  , so if mode == STRICT and
        ## first OR 2nd char is dig, pass off as a pure STR ..hence ensuring the col header line is identified
        if mode == 'STRICT' and digs_ >= 1 and first_occur not in [0,1,len(wd_)-1,len(wd_)-2]: return wd_
        elif mode == 'STRICT' and digs_ == 1 and ( first_occur in [0,1,len(wd_)-1,len(wd_)-2] ): return None

        if ( ( digs_ >= 2 and alpha_ + digs_ + special_char == len(wd_) and digs_ + special_char >= alpha_ ) or\
             ( digs_ >= 1 and alpha_ + digs_ == len(wd_) ) or \
             ( digs_ >= 2 and digs_ + small + alpha_ == len(wd_) and INV_IN_VICINITY is True and allDigsFront( wd_ ) ) ) \
                           and ( len(wd_) >= 3 or ( len(wd_) >= 2 and INV_IN_VICINITY is True ) or\
                           ( len( wd_ ) >= 1 and digs_ == len( wd_ ) ) ):
        #if special_char <= 1 and alpha_ >= 1 and digs_ >= 3 and len(wd_) >= 4:
          print('Returning SUCCESS!!  ',wd_ )
          return wd_

        return None

def xOverlap( val, pts, ref_val, ref_pts, dist_=150 ):
    ## check if anything above or below
    #print( abs( pts[-1] - ref_pts[1] ), pts[0] >= ref_pts[0] and pts[2] <= ref_pts[2], pts, ref_pts )
    if abs( pts[-1] - ref_pts[1] ) <= dist_ or abs( pts[1] - ref_pts[-1] ) <= dist_:
        if ( pts[0] >= ref_pts[0] and pts[2] <= ref_pts[2] ) or \
           ( ref_pts[0] >= pts[0] and ref_pts[2] <= pts[2] ) or \
           ( pts[0] >= ref_pts[0] and pts[0] <= ref_pts[2] ) or \
           ( ref_pts[0] >= pts[0] and ref_pts[0] <= pts[2] ) or \
           ( ref_pts[0] < pts[0] and ref_pts[2] > pts[0] and ref_pts[2] <= pts[2] and ( abs( abs( ref_pts[0] + ref_pts[2] )/2 - ( abs( pts[0] + pts[2] ) )/2 ) )/( min( abs( ref_pts[0] - ref_pts[2]), abs( pts[0] - pts[2] )  )  ) < 0.8 )            or\
           ( pts[0] < ref_pts[0] and pts[2] > ref_pts[0] and pts[2] <= ref_pts[2] and ( abs( abs( ref_pts[0] + ref_pts[2] )/2 - ( abs( pts[0] + pts[2] ) )/2 ) )/( min( abs( ref_pts[0] - ref_pts[2]), abs( pts[0] - pts[2] )  )  ) < 0.8 ):
             #print( val, pts, ' X OVERLAPS with ', ref_val, ref_pts, abs( ref_pts[0] + ref_pts[2]), abs( pts[0] + pts[2] ), abs( ref_pts[0] + ref_pts[2] )/2,  abs( pts[0] + pts[2] )/2, abs( abs( ref_pts[0] + ref_pts[2] )/2 - ( abs( pts[0] + pts[2] ) )/2 )  )
             return True
    return False

def yOverlap( val, pts, ref_val, ref_pts ):
    ## check if anything above or below
    #print('ENTERING yOverlap->', val, pts, ref_val, ref_pts )
    if len( val ) < 1: return False
    if pts == ref_pts: return False
    if ( abs( pts[1] - ref_pts[1] ) <= 20 or ( pts[1] > ref_pts[1] and pts[1] < ref_pts[-1] ) or\
             ( ref_pts[1] > pts[1] and ref_pts[1] < pts[-1] ) ) and pts[0] > ref_pts[0] :
             print( val, pts, ' Y OVERLAPS with ', ref_val, ref_pts, abs( pts[1] - ref_pts[1] ) <= 20,\
                   ( pts[1] > ref_pts[1] and pts[1] < ref_pts[-1] ),\
                   ( ref_pts[1] > pts[1] and ref_pts[1] < pts[-1] ) )
             return True
    return False

def numDigs( txt ):
    numdigs_ = 0
    for char in txt:
      if ord(char) >= 48 and ord(char) <= 57: numdigs_ += 1
    return numdigs_ 

def findElemInLine( line_, srch_arr_, jsn_raw_, hdr_elem_X2=None ):

      for cctr in range( len( line_ ) ):
        wd, pts = line_[ cctr ]['text'], line_[ cctr ]['pts']
        for indwd in wd.split():
          if chkNum( indwd, 0 ) is not None and numDigs( indwd ) > 1: 
            print('JERRY !', wd)
            return None

        if len( wd.split() ) <= 4:
          print(' findElemInLine ->', wd.split(), wd.lower(), srch_arr_ )
          for hdrelem in srch_arr_:
            #if 'desc' in wd.lower(): print( hdrelem, 'desc' in hdrelem, wd.lower(), hdrelem in wd.lower() )
            if hdrelem in wd.lower() and 'unite' not in wd.lower() and 'sub' not in wd.lower()\
              and 'rent' not in wd.lower() and 'term' not in wd.lower(): 
              print('Returning !!', wd.lower()) 
              return line_[ cctr ]
        elif len( wd.split() ) > 4 and len( line_[ cctr ]['ids'] ) >= 3:
          for ln_raw in jsn_raw_['lines']:
            for wdraw in ln_raw:
              if wdraw['id'] not in line_[ cctr ]['ids']: continue

              for hdrelem in srch_arr_:
                if hdrelem in wdraw['text'].lower()[: len(hdrelem)] and 'unite' not in wdraw['text'].lower()\
                  and 'sub' not in wd.lower() and 'rent' not in wd.lower() and 'term' not in wd.lower():
                  print('Returning RAW elems !!', wd, hdrelem, srch_arr_) 
                  return line_[ cctr ]

def checkOverlap( tmpLine, line_ ):

    xover_, booster_ = 0, 50
    for refctr in range( len(line_) ):
      for tmpctr in range( len(tmpLine) ):
        ref_, tmp_ = line_[ refctr ] , tmpLine[ tmpctr ]
        boosted_ = [ tmp_['pts'][0] - booster_, tmp_['pts'][1], tmp_['pts'][2] + booster_, tmp_['pts'][3] ] 
        if xOverlap( tmp_['text'], tmp_['pts'], ref_['text'], ref_['pts'], 2000 ):
          xover_ += 1
        elif xOverlap( tmp_['text'], boosted_, ref_['text'], ref_['pts'], 2000 ):
          xover_ += 1

    print( tmpLine )
    print( [ xover_ ] )
    if xover_ >= 0.5*len(line_) or xover_ >= 2: return True
    return False

def noTotal( line_, ht_, last_pass=None ):

    text_so_far_ = ''

    for wdctr in range( len(line_) ):
      wd = line_[ wdctr ] 
      #if 'total' in wd['text'].lower():
      #print('---------', line_, wd, last_pass )
    
      text_so_far_ += ' ' + wd['text'].lower()

      if ('total' in wd['text'].lower() or 'gst' in wd['text'].lower() or 'page' in wd['text'].lower() or\
         'amount' in wd['text'].lower() or 'tax' in wd['text'].lower() or 'lota' in wd['text'].lower() or\
         'balance' in wd['text'].lower() or 'invoice' in wd['text'].lower() or 'remit' in wd['text'].lower() )\
           and ( ( wd['pts'][1] > ( 0.6*ht_ ) and last_pass is None ) or\
                ( len( wd['text'].split() ) <= 5 and last_pass is not None ) ) : 
          amt_found_ = False
          print('possible end->', [wd], [text_so_far_] ) 
          for innerctr in range( wdctr-1, len( line_ ) ):
            if chkNum( line_[ innerctr ]['text'] ):
              amt_found_ = True
              break

          ## in case the word is conjoined
          for indwd in wd['text'].split():
            if chkNum( indwd ):
              amt_found_ = True
              break

          if 'remit' in text_so_far_: return False

          if amt_found_: return False

    return True

def rationalizeTbl( row_arr_, hdrX2 ):

    if len( row_arr_ ) <= 1: return row_arr_
    
    resp_row_arr_, diffStore, spiff = [], dict(), []

    for row_ctr in range( 1, len(row_arr_) ):
      tmpRow, prevrw = row_arr_[ row_ctr ], row_arr_[ row_ctr-1 ]  
      print('Checking RO->', tmpRow)
      print('Checking RO2->', prevrw)
      prevX2, currX1 = 10000, 10000

      for wd in tmpRow:
        if wd['pts'][1] < currX1: currX1 = wd['pts'][1] 

      for wd in prevrw:
        if wd['pts'][1] < prevX2: prevX2 = wd['pts'][1] 

      diffStore[row_ctr] = abs( currX1 - prevX2 )
      spiff.append( abs(currX1 - prevX2) )

    minDiff ,breaker = spiff[0], len( row_arr_ )
    print( row_arr_[0] )
    firstRow_hdr_diff = abs( row_arr_[0][0]['pts'][1] - hdrX2 )
    #if minDiff > 200 and minDiff > firstRow_hdr_diff: minDiff = firstRow_hdr_diff

    print( 'Diff between ROWS = ', diffStore, firstRow_hdr_diff, minDiff)
    if len( diffStore ) < 1:
      ## means there are only 2 "ROWS" .. hence cant apply the below logic ..simply send back both rows
      return row_arr_
    elif len( diffStore ) == 1 and spiff[0] > 500 and spiff[0] > (2.5)*firstRow_hdr_diff:
        breaker = 1

    for rowIdx, diff in diffStore.items():
      if diff > (2.5)*minDiff or ( minDiff > 100 and diff > 2*minDiff ):
        print('This is where the table breaks ??', row_arr_[ rowIdx ])
        breaker = rowIdx
        break

    for idx in range( len(row_arr_) ):
      if idx == breaker: break
      resp_row_arr_.append( row_arr_[idx] )

    return resp_row_arr_

def rawOverlaps( ids, jsn_raw_, amt_anchor1, amt_anchor2 ):

    for rawLine_ctr in range( len(jsn_raw_['lines']) ):
      rawln = jsn_raw_['lines'][rawLine_ctr]
      for wd in rawln:
        tx, pt = wd['text'], wd['pts']
        if wd['id'] in ids and ( xOverlap( tx, pt, amt_anchor1['text'], amt_anchor1['pts'], 2000 ) or\
          xOverlap( tx, pt, amt_anchor2['text'], amt_anchor2['pts'], 2000 ) ) and \
          len( tx ) >= 3 and chkNum( tx ):

          print('MARIO->Found amount val for RAW table = ', wd)
          return True

    return False  

def minmaxx2y2( potLines_ ):
    #bottomx2, bottomy2 = potLines_[-1][-1]['pts'][2], potLines_[-1][-1]['pts'][3]
    maxx2, maxy2 = [], []
    for line_ in potLines_:
      for wd in line_:
        maxx2.append( wd['pts'][2] )
        maxy2.append( wd['pts'][3] )

    maxx2.sort()
    maxy2.sort()
    return maxx2[-1], maxy2[-1]

def chkLineForNum( pot_hdr_line_ ):

    for wd in pot_hdr_line_:
      if chkNum( wd['text'], mode='STRICT' ) is not None: 
        print('Breaking for this ? ', wd)
        return True

    return False

def nothingPresent( line, coords, common_wd=None ):

    minY = 100000
    for wd in line:
      if wd['pts'][1] < minY: 
        minY = wd['pts'][1]
 
      if ( wd['pts'][2] >= coords[0] and wd['pts'][2] <= coords[2] ) or \
         ( wd['pts'][0] >= coords[0] and wd['pts'][0] <= coords[2] ):
         if common_wd is None or common_wd not in wd['text'] or wd['pts'] == coords:
           print('NEGATIVE->', wd, coords)
           return False

    if abs( coords[1] - minY ) > 100:
      print('THis WONT WOKR !!')
      return False

    return True

def returnNumRows( rawwd, jsn_raw_, endY ):

    ctr_ = 0
    for rl in jsn_raw_['lines']:
      for rlwd in rl:
        if rlwd['pts'][1] > endY: break

        if rlwd['pts'][1] > rawwd['pts'][-1] and xOverlap( rlwd['text'], rlwd['pts'], rawwd['text'], rawwd['pts'] )\
          and chkNum( rlwd['text'] ):
            ctr_ += 1

    return ctr_

def returnRawCols( wd, jsn_raw_ , beginY, endY ):

    if len( wd['ids'] ) == 1: return [ wd ]

    id_arr_, retVals_ = wd['ids'], []

    for id_ in id_arr_:
      for rawline in jsn_raw_['lines']:
        for rawwd in rawline:
          if rawwd['id'] == id_:
            rowCnt = returnNumRows( rawwd, jsn_raw_, endY )
            print('FOr split Col HDR->', rawwd, ' part of ',wd,' no cols = ', rowCnt)
            if rowCnt > 0: 
              retVals_.append( rawwd )

    if len( retVals_ ) > 0: return retVals_ 
    else: return [ wd ]

def makeComplete( potLines_, jsn_, jsn_raw_, table_bottom_, qty_anch, amt_anch ):

    ## complete the header
    hdr_lines_, found_line, anch_line_ = [], False, None
    if qty_anch is None and amt_anch is not None: qty_anch = amt_anch    
    if qty_anch is not None and amt_anch is None: amt_anch = qty_anch   
 
    for linectr in range( len(jsn_['lines']) ):
      line_ = jsn_['lines'][linectr]

      hdr_lines_.append( linectr )
      for wd in line_:
        if wd['pts'] == qty_anch['pts'] or wd['pts'] == amt_anch['pts']:
          found_line = True
          anch_line_ = line_
          break
      
      if found_line: break           

    print( hdr_lines_ )
    rng_ = [ jsn_['lines'][ hdr_lines_[-2] ], jsn_['lines'][ hdr_lines_[-1]+1 ] ]
    print('((((((')
    print( rng_, anch_line_ )
    print('***************')
    unsorted_D = dict()
    for element in anch_line_:
      unsorted_D[ element['pts'][0] ] = element

    sorted_D = sorted( list(unsorted_D.keys()) )
    print('BORO->', sorted_D)
    hdr_elements_ = []
    for sortKey in sorted_D:
      hdr_elements_.append( unsorted_D[ sortKey ] )

    print( hdr_elements_ )
    neo_rng_, neo_anch_ = [], None

    for line_tmp in ( rng_ + [ anch_line_ ] ):
      print('Before XFORM->', line_tmp)
      if abs( line_tmp[-1]['pts'][1] - anch_line_[-1]['pts'][1] ) > 100: continue

      if chkLineForNum( line_tmp ): 
        print('Line jas num->', line_tmp)
        neo_rng_.append( line_tmp )
      else:
        ## split conjoined col headers !!
        new_line_arr_ = []
        for wd in line_tmp:
          cols_ = returnRawCols( wd, jsn_raw_ , anch_line_[0]['pts'][-1], table_bottom_ )
          for rccol in cols_:
            new_line_arr_.append( rccol )

        if len( new_line_arr_ ) > 0:
          neo_rng_.append( new_line_arr_ )
          print('AFTER XFORM->', new_line_arr_)
        else:
          neo_rng_.append( line_tmp )

    ## since we had added anch line in the end just so that the same code need not eb repeated
    ## we now simply extract it and assign it to neo_anch_
    neo_anch_ = neo_rng_[-1]
    neo_rng_.pop(-1) ## we want it to go back to the same lenght and rng_
    anch_line_ = neo_anch_ 

    #for pot_hdr_line_ in rng_: 
    ## BELOW LOOP will ensure that lines ABOVE and BELOW anchor COL row will append to xoverlaps
    for pot_hdr_line_ in neo_rng_: 
      if chkLineForNum( pot_hdr_line_ ): continue

      for potwd in pot_hdr_line_:
        for refwd in anch_line_:
          if abs( potwd['pts'][1] - refwd['pts'][1] ) <= 100 and xOverlap( potwd['text'], potwd['pts'], \
                                                                           refwd['text'], refwd['pts'] ):
            print('Found DOBU above/below->', potwd,' near REF ', refwd)
            if potwd['pts'][1] > refwd['pts'][1]:
              refwd['text'] = refwd['text'] +' '+potwd['text']
              refwd['pts'] = [ refwd['pts'][0], refwd['pts'][1], min( potwd['pts'][2], refwd['pts'][2] ), potwd['pts'][3] ] 
              print('New REFWD 0.1 = ', refwd, potwd )
            if potwd['pts'][1] < refwd['pts'][1]:
              refwd['text'] = potwd['text']+' '+refwd['text']
              refwd['pts'] = [ potwd['pts'][0], potwd['pts'][1], min( potwd['pts'][2], refwd['pts'][2] ), refwd['pts'][3] ] 
              print('New REFWD 0.2 = ', refwd, potwd )

    ## BELOW LOOP will ensure that lines ABOVE and BELOW also have matching elements stitched ..for e.g
    '''
    A    B   C    D
             E
         X        Y
    in the prev for ONLY CE will be stitched since E is the ref line but ideally BX and DY also need to be st
    '''
    for pot_hdr_line_ in neo_rng_: 
      if chkLineForNum( pot_hdr_line_ ): continue
      for pot_wd in pot_hdr_line_:

        for innerpot in neo_rng_:
          if chkLineForNum( innerpot ): continue
          if innerpot == pot_hdr_line_: continue
          for inner_wd in innerpot:
            
            if ( pot_wd['pts'][1] - inner_wd['pts'][1] ) <= 100 and xOverlap( pot_wd['text'], pot_wd['pts'],\
                                                                            inner_wd['text'], inner_wd['pts'] ):   

              if pot_wd['pts'][1] < inner_wd['pts'][1] and nothingPresent( anch_line_, \
                                               [ max( pot_wd['pts'][0], inner_wd['pts'][0] ), pot_wd['pts'][1] ] + \
                                               [ min( pot_wd['pts'][2], inner_wd['pts'][2] ), inner_wd['pts'][-1] ],\
                                               pot_wd['text'] ):

                txt_ = pot_wd['text'] + ' ' + inner_wd['text']
                pts_ = [ max( pot_wd['pts'][0], inner_wd['pts'][0] ), pot_wd['pts'][1] ] +\
                       [ min( pot_wd['pts'][2], inner_wd['pts'][2] ), inner_wd['pts'][-1] ]
                ids_ = pot_wd['ids'] + inner_wd['ids'] 
                anch_line_.append( { 'text': txt_ , 'pts': pts_, 'ids': ids_ } ) 
                print('New REFWD2 = ', anch_line_[-1] )

              elif pot_wd['pts'][1] > inner_wd['pts'][1] and nothingPresent( anch_line_, \
                                             [ max( pot_wd['pts'][0], inner_wd['pts'][0] ), inner_wd['pts'][1] ] + \
                                             [ min( pot_wd['pts'][2], inner_wd['pts'][2] ), pot_wd['pts'][-1] ],\
                                             inner_wd['text'] ) :

                txt_ = inner_wd['text'] + ' ' + pot_wd['text']
                pts_ = [ max( pot_wd['pts'][0], inner_wd['pts'][0] ), inner_wd['pts'][1] ] +\
                       [ min( pot_wd['pts'][2], inner_wd['pts'][2] ), pot_wd['pts'][-1] ]
                #pts_ = inner_wd['pts'][:2] + [ min( pot_wd['pts'][2], inner_wd['pts'][2] ), pot_wd['pts'][-1] ]
                ids_ = pot_wd['ids'] + inner_wd['ids'] 
                anch_line_.append( { 'text': txt_ , 'pts': pts_, 'ids': ids_ } ) 
                print('New REFWD3 = ', anch_line_[-1] )
              

    ## BELOW LOOP will ensure that the enachor col row has the final list of elems ..taking above example
    ## A BX CE DY 
    print('BEFORE STAR->', anch_line_)
 
    for pot_hdr_line_ in neo_rng_:
      if chkLineForNum( pot_hdr_line_ ): continue
      for pot_wd in pot_hdr_line_:

        for innerpot in neo_rng_:
          if chkLineForNum( innerpot ): continue
          if innerpot == pot_hdr_line_: continue

          for inner_wd in innerpot:
            #if abs( inner_wd['pts'][1] - pot_wd['pts'][1] ) > 100: continue

            if nothingPresent( anch_line_, pot_wd['pts'] ):
                anch_line_.append( pot_wd ) 
                print('New REFWD = 1', anch_line_, pot_wd, inner_wd )

            elif nothingPresent( anch_line_, inner_wd['pts'] ):
                anch_line_.append( inner_wd ) 
                print('New REFWD = 2', anch_line_, pot_wd, inner_wd )
            
                 
    print('***************')
    unsorted_D = dict()
    for element in anch_line_:
      unsorted_D[ element['pts'][0] ] = element

    sorted_D = sorted( list(unsorted_D.keys()) )
    print('BORO->', sorted_D)
    hdr_elements_ = []
    for sortKey in sorted_D:
      hdr_elements_.append( unsorted_D[ sortKey ] )

    print( hdr_elements_ )
    print( anch_line_ )
 
    return hdr_elements_

def mostlyWd( txt_ ):

    arr = txt_.split()
    numwd, numdigs = 0, 0
    for wd in arr:
      for char in wd:
        if ord(char) >= 48 and ord(char) <= 57: numdigs += 1
        if ord(char) >= 65 and ord(char) <= 90: numwd += 1
        if ord(char) >= 97 and ord(char) <= 122: numwd += 1

    if numwd >= (1.5)*numdigs or ( numwd >= 3 ): return True
    return False  

def prevOverlap( currwd, prev_ ):
    
    minDistThresh_ = 20
   
    for wd in prev_:
      print('IN prevOverlap ->', wd,' xOverlap = ',currwd)
      if mostlyWd( wd['text'] ) and xOverlap( currwd['text'], currwd['pts'], wd['text'], wd['pts'] )\
        and abs( currwd['pts'][1] - wd['pts'][-1] ) < minDistThresh_:
          print('Curr ', currwd, ' is an STR and overlaps with ', wd, ' from line ', prev_ )
          return True

    return False

def findPotentialTblHdrs( jsn_, jsn_raw_, fnm, base_tbl_hdr_ ):

    hdr_anch, qty_anch, amt_anch = None, None, None
    anch_arr, line_arr, getOut_, fp_arr = [], [], False, []

    for line_ctr1 in range( len(jsn_['lines']) ):
      line_ = jsn_['lines'][line_ctr1]
      hdr_anch = findElemInLine( line_, main_hdr_anchor_, jsn_raw_ )
      print( 'Reviewing line->', line_, [ hdr_anch ] )

      '''  
      for wd in line_:
        if wd['pts'][1] > jsn_['height']*(0.9):
          getOut_ = True
          break
      '''  

      if len( anch_arr ) > 0 and hdr_anch is not None:
        lastLn = anch_arr[-1]
        if abs( lastLn['pts'][-1] - hdr_anch['pts'][1] ) <= 20: break

      if getOut_ is True: break

      if hdr_anch is not None and chkLineForNum( line_ ) is False and len( line_ ) >= 2: 
        if base_tbl_hdr_ is not None:
          for base_elem in base_tbl_hdr_:
            if fuzz.ratio( base_elem['text'].lower(), hdr_anch['text'].lower() ) >= 90 or\
               hdr_anch['text'].lower() in base_elem['text'].lower():

              print('ADD1')
              anch_arr.append( hdr_anch )
              line_arr.append( line_ctr1 )
            else:
              fp_arr.append( hdr_anch )
        else:

              print('ADD1')
              anch_arr.append( hdr_anch )
              line_arr.append( line_ctr1 )

    if len( anch_arr ) == 0:

      for line_ctr1 in range( len(jsn_['lines']) ):
        line_ = jsn_['lines'][line_ctr1]
        print('Reviewing line->', line_)
        hdr_anch = findElemInLine( line_, bkp_hdr_anchor_, jsn_raw_ )
        if hdr_anch is not None and chkLineForNum( line_ ) is False and len( line_ ) >= 2: 
          if base_tbl_hdr_ is not None:
            for base_elem in base_tbl_hdr_:
              if fuzz.ratio( base_elem['text'].lower(), hdr_anch['text'].lower() ) >= 90 or\
                 hdr_anch['text'].lower() in base_elem['text'].lower():

                print('ADD2')
                anch_arr.append( hdr_anch )
                line_arr.append( line_ctr1 )
              else:
                fp_arr.append( hdr_anch )
          else:

                print('ADD2')
                anch_arr.append( hdr_anch )
                line_arr.append( line_ctr1 )

    return anch_arr, line_arr , fp_arr

def whatIsDtype( txt ):

    numL, numS, numD = 0, 0, 0
    for char in txt:
      if ord(char) >= 48 and ord(char) <= 57: numD += 1
      if ord(char) >= 65 and ord(char) <= 90: numL += 1
      if ord(char) >= 97 and ord(char) <= 122: numS += 1

    if ( numD > 0 and numL <= 1 and numS == 0 ) or \
      ( numD > 0 and numD > ( numS + numL ) ) or ( numD >= 2 and numL > ( numD + numS ) ):
      return 'NUM'

    if ( numS > 0 and numS > ( numD + numL ) ):
      return 'STR'

    return 'NON'

def determineColHdrDataTypes( hdr_arr_, tbl_bounds_ , jsn_ ):

    dataTypes_ = dict()

    for line_ in jsn_['lines']:
      for wd in line_:
        if wd['pts'][1] < tbl_bounds_[1] or wd['pts'][-1] > tbl_bounds_[-1]: 
          print( wd, ' ouT OF BOUNDS ' )
          continue
        for colHdr in hdr_arr_:
          colNm, colPts = colHdr['text'], colHdr['pts']  
          #print('GOLI->', wd, colNm, colPts, colPts[-1] < wd['pts'][1], \
          #                           xOverlap( wd['text'], wd['pts'], colNm, colPts ) )

          if colPts[-1] < wd['pts'][1] and xOverlap( wd['text'], wd['pts'], colNm, colPts, 3000 ):
            dtype_ = whatIsDtype( wd['text'] )      

            if colNm in dataTypes_:
              dtype_arr_ = dataTypes_[ colNm ]
            else:
              dtype_arr_ = []
            
            dtype_arr_.append( dtype_ )
            dataTypes_[ colNm ] = dtype_arr_
            print( '---', colNm , wd['text'], dtype_ ) 

    finalResp = dict()
    for colNm, dtypearr in dataTypes_.items():
      tmpD = dict()
      for elem in dtypearr:
        if elem in tmpD: tmpD[ elem ] += 1
        else: tmpD[ elem ] = 1

      sortedD = dict( sorted( tmpD.items(), key=lambda x:x[1], reverse=True ) )
      print( 'BOJI->', sortedD, colNm, dtypearr, hdr_arr_)
      finalResp[ colNm ] = list( sortedD.keys() )[0]

    return finalResp

def detectTblWithoutHeader( jsn_, jsn_raw, base_tbl_hdr_, responseTbleArr, responseTblHdr ):
    
    '''
    loop through all lines and ensure that IN ANY given line, you get an xoverlap with ALL the headers
    and they are all the exact datatype as the base tbl hdr..thats when u begin counting the rows
    table bounds automatically become first and last line of table
    but where do u break ? for now, the first line where u dont find the match (AFTER finding a bunch
    of matches, should be where u break )
    ''' 
    table_lines_, xarr, yarr, x2arr, y2arr = [], [], [], [], []

    for line_ in jsn_['lines']:
      base_tbl_matches_, numDtypes = 0, 0

      for wd_ in line_:

        for hdrCol in base_tbl_hdr_:
          if xOverlap( wd_['text'], wd_['pts'], hdrCol['text'], hdrCol['pts'], 10000 ) and\
            whatIsDtype( wd_['text'] ) == hdrCol['dtype']:
            print('Element ', wd_, ' Matches base table elem ->', hdrCol)
            base_tbl_matches_ += 1 
            if hdrCol['dtype'] == 'NUM': numDtypes += 1

      print( 'LASER->', line_, base_tbl_matches_, numDtypes, len(table_lines_),\
                     len( base_tbl_hdr_ ) )
      if base_tbl_matches_ >= len( base_tbl_hdr_ )*0.5 and numDtypes >= 1 and \
        ( len(table_lines_) == 0 or abs( table_lines_[-1][-1]['pts'][-1] - line_[-1]['pts'][1] ) <= 100 ) :
        print('Line belongs to table !!', line_)  
        table_lines_.append( line_ )

    print( table_lines_ )

    if len( table_lines_ ) > 0:
      return [ table_lines_[0][0]['pts'][0], table_lines_[0][0]['pts'][1], \
               table_lines_[-1][-1]['pts'][2], table_lines_[-1][-1]['pts'][3] ]
    else:
      return [0 ,0, 0, 0]

def detectTable( jsn_, jsn_raw_, fnm_img_, fnm, anch_arr, line_arr, \
                    responseTbleArr, responseTblHdr, nextY1, master_anch_arr, base_tbl_hdr_ ):

    hdr_anch, qty_anch, amt_anch = None, None, None
    getOut_ = False

    if len( anch_arr ) > 0: # parse this line, prev line and next line looking for remaining 2
      print('DOBBS->', anch_arr, line_arr)
      for anchctr in range( len(anch_arr) ):
          hdr_anch, line_ctr = anch_arr[ anchctr ], line_arr[ anchctr ] 
          line_ = jsn_['lines'][line_ctr]
          print('Found hdr line ??', hdr_anch)
          neo_hdr_anch = None

          mx2prev, my2prev = minmaxx2y2( [ jsn_['lines'][ max( 0, line_ctr-1 ) ] ] )
          mx2next, my2next = minmaxx2y2( [ jsn_['lines'][ min( line_ctr+1, len(jsn_['lines'])-1 ) ] ] )
          currLine_x2, currLine_y2 = minmaxx2y2( [ line_ ] )
          ## NEED TO ENSURE prev and next lines aren't like 100's of pixels away ..thats retarded
          prev_line_ = jsn_['lines'][ max( 0, line_ctr-1 ) ] if abs( currLine_y2 - my2prev ) <= 100 else line_
          next_line_ = jsn_['lines'][ min( line_ctr+1, len(jsn_['lines'])-1 ) ] \
                         if abs( currLine_y2 - my2next ) <= 100 else line_

          print('CHecking lines->', prev_line_, next_line_, line_)  
          hdrX2 = hdr_anch['pts'][-1]

          search_space_ = [ prev_line_ , line_, next_line_ ]

          for pot_hdr_line in search_space_: 
            print('QTY/AMT check->', pot_hdr_line)
            if qty_anch is None:
              qty_anch = findElemInLine( pot_hdr_line, qty_, jsn_raw_, hdrX2 )
              print('Found QTY anchor->', qty_anch)
            if amt_anch is None:
              amt_anch = findElemInLine( pot_hdr_line, amt_, jsn_raw_, hdrX2 )
              print('Found AMT anchor->', amt_anch)
            
            ## BREAKING CHANGE .. remove the IF , worst case
            if neo_hdr_anch is None:
              neo_hdr_anch = findElemInLine( pot_hdr_line, main_hdr_anchor_ + bkp_hdr_anchor_, jsn_raw_ )
            print('LAST CHECK->', neo_hdr_anch)

          print('SHOULS IT BREAK ? ', qty_anch, amt_anch, hdr_anch)
          if ( qty_anch is None and amt_anch is None ) or ( neo_hdr_anch is not None and\
                                        neo_hdr_anch['pts'] != hdr_anch['pts'] and \
                                        abs( neo_hdr_anch['pts'][1] - hdr_anch['pts'][1]  ) > 10 ): 
            hdr_anch = None 
          elif ( qty_anch is not None or amt_anch is not None ): break

    if ( ( hdr_anch is not None and ( qty_anch is not None or amt_anch is not None ) ) or \
         ( hdr_anch is None and qty_anch is not None and amt_anch is not None ) ) and len( line_ ) >= 2:
        print('Found Table Begin->', hdr_anch, qty_anch, amt_anch, line_ )
        if hdr_anch is None:
          hdr_anch = qty_anch

        hdrX2, hdrY1 = hdr_anch['pts'][-1], hdr_anch['pts'][1]
        hdrx1, hdry1 = jsn_['lines'][line_ctr][0]['pts'][0], jsn_['lines'][line_ctr][0]['pts'][1]
        ## check if the next line / 2 has an 
        potLines_, no_tot_, table_bottom_, firstLineAmt = [], True, None , None
        amt_anchor1, amt_anchor2 = line_[-2], line_[-1] ## take the last 2 elements of HDR line for amt

        ## breaking change .. chknum with laxity of 1 digit
        if not ( ( chkNum( amt_anchor1['text'] ) and numDigs( amt_anchor1['text'] ) > 1 ) or \
                 (  chkNum( amt_anchor2['text'] ) and numDigs( amt_anchor2['text'] ) > 1 ) ):
          print('MAJOR PTS->', amt_anchor1, amt_anchor2)

          for pot_amt_line in range( line_ctr+1, len(jsn_['lines']) ):
            tmpLine = jsn_['lines'][pot_amt_line]
            print('LETS TASTE->', tmpLine)
            for ctr in range( len(tmpLine) ):
              tmpwd, tmppts = tmpLine[ctr]['text'], tmpLine[ctr]['pts']
              ## try finding end of table
              #if len( responseTbleArr ) > 0:
              no_tot_ = noTotal( tmpLine, jsn_['height'], last_pass='YES' )
            
              if no_tot_ is False: 
                table_bottom_ = tmppts[1] - 5 ## this is to avoid needless conflict 
                print('TBL BOTTOM->', tmpLine, table_bottom_)
                break  
              print('REVIEW->', tmpwd, chkNum( tmpwd ))
              boosted_pts = [ tmppts[0] - 50, tmppts[1], tmppts[2] + 50, tmppts[3] ]
              '''  
              ## to take care of overlaps like -- so boost x0 and x2 by values
              Hdr
              -------
                  Value
              OR

                    Hdr
                -------
              Value
              '''  
              if chkNum( tmpwd ) and ( ( xOverlap( tmpwd, tmppts, amt_anchor1['text'], amt_anchor1['pts'], 2000 ) or\
                                     xOverlap( tmpwd, tmppts, amt_anchor2['text'], amt_anchor2['pts'], 2000 ) ) or\
              ( xOverlap( tmpwd, boosted_pts, amt_anchor1['text'], amt_anchor1['pts'], 2000 ) or\
                             xOverlap( tmpwd, boosted_pts, amt_anchor2['text'], amt_anchor2['pts'], 2000 ) ) ): 
                print('MARIO->Found amount val for table = ', tmpwd)
                if checkOverlap( tmpLine, line_ ) and no_tot_ is True: 
                  potLines_.append( tmpLine )
                  if firstLineAmt is None: firstLineAmt = tmpLine[-1]['pts'][-1]
                  break
                elif no_tot_ is False:
                  table_bottom_ = tmppts[1] 
                  print('FOUND TBL BOTTOM->', table_bottom_)
                  break

              elif 'ids' in tmpLine[ctr] and len( tmpLine[ctr]['ids'] ) >= 4 and \
                rawOverlaps( tmpLine[ctr]['ids'], jsn_raw_, amt_anchor1, amt_anchor2 ) and no_tot_ is True :
                  potLines_.append( tmpLine )
                  if firstLineAmt is None: firstLineAmt = tmpLine[-1]['pts'][-1]
                  break

            if no_tot_ is False: 
              print('Found TOTO -> breaking ')
              break  

          if len( potLines_ ) > 0:
            print('Rows in the table->', potLines_)    
            if table_bottom_ is not None:
              hdr_arr_ = makeComplete( potLines_, jsn_, jsn_raw_, table_bottom_, qty_anch, amt_anch )
            else:
              bottomY = potLines_[-1][-1]['pts'][-1]
              hdr_arr_ = makeComplete( potLines_, jsn_, jsn_raw_, bottomY, qty_anch, amt_anch )

            cx1, cy1, cx2, cy2, minY2 = [], [], [], [] , -1

            for hdrCol in hdr_arr_:
               cx1.append( hdrCol['pts'][0] )
               cx2.append( hdrCol['pts'][2] )

               cy1.append( hdrCol['pts'][1] )
               cy2.append( hdrCol['pts'][3] )
               if hdrCol['pts'][3] > minY2: minY2 = hdrCol['pts'][3]

               #cv2.rectangle( fnm_img_, ( hdrCol['pts'][0], hdrCol['pts'][1] ), \
               #                         ( hdrCol['pts'][2], hdrCol['pts'][3] ), (255, 0, 255), 3 )

            hdrx1, hdry1       = sorted( cx1 )[0], sorted( cy1 )[0]
            bottomx2, bottomy2, noBottom = sorted( cx2 )[-1], sorted( cy2 )[-1], False

            potLines_ = rationalizeTbl( potLines_, hdrX2 )
            bottomx2, bottomy2 = minmaxx2y2( potLines_ )[0], table_bottom_
            if bottomy2 is None:
              print('Unable to find BOTTOM TOP so replacing it with -> ', minmaxx2y2( potLines_ ), potLines_, nextY1 )
              bottomy2 = minmaxx2y2( potLines_ )[1] 
              noBottom = True
            else:
              print('able to find BOTTOM TOP -> ', bottomy2, nextY1 )

            minx0, maxx2, ydistances, prevLine, lastYsent, lastRelLine = [], [], [], None, [], 0
            for lllctr in range( len(jsn_['lines'])):
              lll, maxyy = jsn_['lines'][ lllctr ], -1
              for wdl in lll:
                if wdl['pts'][1] >= hdry1 and wdl['pts'][1] < bottomy2:
                  minx0.append( wdl['pts'][0] )
                  maxx2.append( wdl['pts'][2] )
               
              for wdl in lll:
                  if wdl['pts'][1] > maxyy: maxyy = wdl['pts'][1]
              print('GONNA NAN MAGANE-> maxyy, hdry1, bottomy2 = ', jsn_['lines'][lllctr], maxyy, hdry1, bottomy2, nextY1) 
              if prevLine is not None and maxyy >= hdry1 and maxyy <= bottomy2 and \
                ( nextY1 is None or ( nextY1 is not None and maxyy < nextY1['pts'][1] ) ):
                ydistances.append( lll[-1]['pts'][1] - prevLine )
                lastYsent = [ lll[-1]['pts'][1], lll[-1]['pts'][3] ]
                lastRelLine = lllctr              
                print('Last REL LINE = ', lll) 
 
              prevLine = lll[-1]['pts'][-1] 

            ## now check IF the last few rows of DESC column wasn't chosen for table lower bound
            ## iterate the "lines" after table bound and check if there's a text only col
            ## once u find that, check prev line for xoverlap AND Y dist < 10 and simply increment
            ## tbl Y2
            print('JUS B4 eval for incr->', jsn_['lines'][lastRelLine]) 
            #for ctr in range( lastRelLine, len(jsn_['lines']) ):
            y2updated_ = False
            for ctr in range( lastRelLine+1, len(jsn_['lines']) ):
              curr_, prev_ = jsn_['lines'][ctr], jsn_['lines'][ctr-1]  
              
              print('EVALUATING INCR->', curr_)
              for currwdctr in range( len( curr_ ) ):
                currwd = curr_[ currwdctr ]
                print('Running INCR loop ->', currwd['text'], mostlyWd( currwd['text'] ), \
                        prevOverlap( currwd, prev_ ), noTotal( curr_, jsn_['height'] ) )
                if mostlyWd( currwd['text'] ) and prevOverlap( currwd, prev_ ) and noTotal( curr_, jsn_['height'],last_pass='YES' ):
                  print('INCREMENTING Y2 .. since ', currwd)
                  bottomy2 = currwd['pts'][-1]
                  y2updated_ = True
                  break

              if y2updated_ == False: break

            ## 2nd pass to find table bottom..in the first pass we look for total, tax etc
            ## but with a qualifier ..it needs to be in the bottom 40% of the doc
            ## in some cases though, it could be in the first 50 itself
            bottomUpdated_ = False
            if bottomy2 >= 0.6*jsn_['height'] or noBottom is True:
              for line in jsn_['lines']:
                if minY2 > 0 and line[-1]['pts'][-1] <  minY2: continue
                if minY2 < 0 and line[-1]['pts'][-1] <  hdry1: continue
 
                print( '2nd pass check ->', line, hdry1, bottomy2, line[-1]['pts'], noTotal( line, jsn_['height'], last_pass='YES' ), abs( line[-1]['pts'][1] - bottomy2 ) <= 5, line[-1]['pts'][1] > hdry1, firstLineAmt )

                if noTotal( line, jsn_['height'], last_pass='YES' ) is False and ( line[-1]['pts'][1] < bottomy2 or\
                  ( line[-1]['pts'][1] < bottomy2 and abs( line[-1]['pts'][1] - bottomy2 ) <= 5 ) ) \
                  and line[-1]['pts'][1] > hdry1 and \
                  ( nextY1 is None or ( nextY1 is not None and maxyy < nextY1['pts'][1] ) ):
                  if ( firstLineAmt is not None and line[-1]['pts'][1] > firstLineAmt ) or\
                     firstLineAmt is None:
                    neobottomy2 = line[-1]['pts'][1]
                    print('2nd pass update-> from ', bottomy2, ' to ', neobottomy2, line[-1])
                    bottomy2 = neobottomy2
                    bottomUpdated_ = True
                    break 
             
            #if bottomUpdated_ is False and len(lastYsent) > 0 and bottomy2 is not None \
            #  and lastYsent[0] < bottomy2 and lastYsent[1] < bottomy2 :
            if bottomUpdated_ is False and len(master_anch_arr) > 1 and bottomy2 is not None\
              and y2updated_ is False:
              another_pot_tbl_ = False
              for tmpanch in master_anch_arr:
                if bottomy2 > tmpanch['pts'][3] and tmpanch['pts'][1] > lastYsent[1]:
                 print('Either ONE of MANY TABLES on the same page OR just slightly above ->', \
                       bottomy2, lastYsent, tmpanch)
                 bottomy2 = lastYsent[1]
 
            print('ABOUT TO DUMP FINALLY :P = ', ( hdrx1, hdry1 ), ( bottomx2, bottomy2 ) ) 
            print('NO.. FINALLY ..SERIOUSLY.. :P = ', ( min(minx0), hdry1 ), ( max(maxx2), bottomy2 ), lastYsent ) 
            print('ydistances ', ydistances, lastYsent, bottomy2)
            #cv2.rectangle( fnm_img_, ( min(minx0), hdry1 ), ( max(maxx2), bottomy2 ), (255, 0, 255), 3 )
            #cv2.imwrite( 'TBL_DETECTION/TBL_DET_' + fnm +'.jpg', fnm_img_ )
            responseTbleArr.append( [ hdrx1, hdry1, bottomx2, bottomy2 ] )
            ## determine col header data type
            dataTypes_ = determineColHdrDataTypes( hdr_arr_, [ hdrx1, hdry1, bottomx2, bottomy2 ], jsn_ )
            print('DTYPE MOFOS->', dataTypes_)
            for elem in hdr_arr_:
              if elem['text'] not in dataTypes_:
                elem['dtype'] = 'NON'
              else:
                elem['dtype'] = dataTypes_[ elem['text'] ]

            print('DTYPE MOFOS->', hdr_arr_)
            responseTblHdr.append( hdr_arr_ )
            return [ hdrx1, hdry1, bottomx2, bottomy2 ], hdr_arr_
    else:
        hdr_anch, qty_anch, amt_anch = None, None, None 
   
    #cv2.imwrite( 'TBL_DETECTION/TBL_DET_' + fnm +'.jpg', fnm_img_ )
    return [0, 0, 0, 0], []      

def tableDetectionEndPoint( jsnArr_ext ):

    response_, base_tbl_hdr_, fnm_img_ = dict(), None, None
    jsnArr = sorted( jsnArr_ext, key=lambda x: x['fnm'] )

    for fnmctr in range( len(jsnArr) ):
       
      fnm, jsn_, jsn_raw = jsnArr[ fnmctr ]['fnm'], jsnArr[ fnmctr ]['json'], jsnArr[ fnmctr ]['json_raw']

      responseTbleArr, responseTblHdr = [], []
        
      anch_arr, line_arr, fp_arr = findPotentialTblHdrs( jsn_, jsn_raw, fnm, base_tbl_hdr_ )
   
      for ctr in range( len( anch_arr ) ):
        anch_, line_ = anch_arr[ ctr ] , line_arr[ ctr ]
        nextAnchBegin_ = anch_arr[ ctr+1 ] if ctr < len(anch_arr) - 1 else None
        print('BEGIN COLLECTION->', anch_, anch_arr)
        try: 
          tbl_bounds_, hdr_ = detectTable( jsn_, jsn_raw, fnm_img_, fnm, [ anch_ ], [ line_ ], \
                                 responseTbleArr, responseTblHdr, nextAnchBegin_, anch_arr, base_tbl_hdr_ )
        except:
          print( traceback.format_exc() )
          continue

        print('END COLLECTION->', responseTbleArr, responseTblHdr)

      ## check for FPs in the table
      if len( responseTbleArr ) == 1 and base_tbl_hdr_ is not None and\
        abs( abs( responseTblHdr[0][0]['pts'][0] - responseTblHdr[0][-1]['pts'][2] ) - \
             abs( base_tbl_hdr_[0]['pts'][0] - base_tbl_hdr_[-1]['pts'][2] ) ) > 200:
        print( 'Page might have an FP since table width = ', \
               abs( responseTblHdr[0][0]['pts'][0] - responseTblHdr[0][-1]['pts'][2] ),\
               ' and base width = ', abs( base_tbl_hdr_[0]['pts'][0] - base_tbl_hdr_[-1]['pts'][2] ) )
        responseTbleArr = []

      if len( responseTbleArr ) == 1 and fnmctr == 0:
        print('First Page Header can be used as base->', responseTblHdr[ fnmctr ])
        base_tbl_hdr_ = responseTblHdr[ fnmctr ]
      elif len( responseTbleArr ) > 1 and fnmctr == 0:
        print('First Page Header, last table can be used as base->', responseTblHdr[-1])
        base_tbl_hdr_ = responseTblHdr[-1]
      elif len( responseTbleArr ) == 0 and fnmctr > 0:
        print('Page num ', fnmctr,' has no table detected ..trying with base tbl ', base_tbl_hdr_)
        print('BUT has FPs = ', fp_arr )
        tbl_bounds_ = detectTblWithoutHeader( jsn_, jsn_raw, base_tbl_hdr_, responseTbleArr, responseTblHdr )
        responseTbleArr.append( tbl_bounds_ )
        responseTblHdr = base_tbl_hdr_
        #responseTbleArr.append( tbl_co_ords_ )
        #responseTblHdr.append( colHdrs )
      print('Page Number', fnmctr, responseTbleArr )
      response_[ fnm ] = {'TBL_BOUNDS': responseTbleArr, 'TBL_HDRS': responseTblHdr }

    return response_ 

if __name__ == '__main__':
    import sys

    src_0 = '/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT/'
    src_raw = '/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT_ORIGINAL/'
    src_ = '/home/ubuntu/ABHIJEET/INVOICES/TABLE_DETECTION/YOLO_TEST/new/ALL_OCR_OUTPUT/'
    src_img_ = '/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/TABLE_COMPARISON/'
    #ll = os.listdir( './TBL_FAILS/' )
    ll = os.listdir( src_0 )
    multi_pg_arr_ = []
    test_file = sys.argv[1]

    for inner in ll:
      if 'output' in inner or 'input' in inner or 'global' in inner: continue
      if test_file in inner:
        multi_pg_arr_.append( inner )

    print( 'How many ?', multi_pg_arr_)
    #for file_ in ll:
    #if True:
    base_tbl_hdr_, jsnArr = None, []

    for elem in multi_pg_arr_:

      with open( src_0+elem, 'r' ) as fp:
        jsn_ = json.load( fp )

      with open( src_raw+elem, 'r' ) as fp:
        jsn_raw = json.load( fp )

      jsnArr.append( {'fnm': elem, 'json': jsn_, 'json_raw': jsn_raw } ) 

    print( tableDetectionEndPoint( jsnArr ) )
