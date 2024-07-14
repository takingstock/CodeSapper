import pickle, boto3, traceback, os

class s3_utils():
    def __init__( self ):

        self.bucket_name_ = os.getenv('NETWORKX_S3')
        self.s3_client = boto3.client('s3')

    def shipToS3( self, file_nm, contents, pickle=False ):

        print('Shipping to bucket ->', self.bucket_name_)
        if pickle == True:    
            pickled_file_ = pickle.dumps( contents )
            self.s3_client.put_object(Bucket=self.bucket_name_, Key=file_nm, Body=pickled_file_ )
        else:
            self.s3_client.put_object(Bucket=self.bucket_name_, Key=file_nm, Body=contents )

    def readFromS3( self, file_nm ):
        try:
            response = self.s3_client.get_object( Bucket=self.bucket_name_, Key=file_nm )
        except:
            print('S3 retreival failure->', traceback.format_exc())
            return None

        return response['Body'].read()

if __name__ == "__main__":
    s3_ = s3_utils()
    print( s3_.readFromS3( 'graph_store.pickle' ) )
