# import libraries
import os
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential

# set `<your-endpoint>` and `<your-key>` variables with the values from the Azure portal
endpoint = "https://idp-amygb.cognitiveservices.azure.com/"
key =  "974d555b48494349871d0f3a7467b37a"

# formatting function
def format_polygon(polygon):
    if not polygon:
        return "N/A"
    return ", ".join(["[{}, {}]".format(p.x, p.y) for p in polygon])

def analyze_layout():
    # sample document
    formUrl = "https://raw.githubusercontent.com/Azure-Samples/cognitive-services-REST-api-samples/master/curl/form-recognizer/sample-layout.pdf"

    document_analysis_client = DocumentAnalysisClient(
        endpoint=endpoint, credential=AzureKeyCredential(key)
    )

    poller = document_analysis_client.begin_analyze_document_from_url(
        "prebuilt-layout", formUrl
    )
    result = poller.result()

    for idx, style in enumerate(result.styles):
        print(
            "Document contains {} content".format(
                "handwritten" if style.is_handwritten else "no handwritten"
            )
        )

    for page in result.pages:
        print("----Analyzing layout from page #{}----".format(page.page_number))
        print(
            "Page has width: {} and height: {}, measured with unit: {}".format(
                page.width, page.height, page.unit
            )
        )

        for line_idx, line in enumerate(page.lines):
            words = line.get_words()
            print(
                "...Line # {} has word count {} and text '{}' within bounding polygon '{}'".format(
                    line_idx,
                    len(words),
                    line.content,
                    format_polygon(line.polygon),
                )
            )

            for word in words:
                print(
                    "......Word '{}' has a confidence of {}".format(
                        word.content, word.confidence
                    )
                )

        for selection_mark in page.selection_marks:
            print(
                "...Selection mark is '{}' within bounding polygon '{}' and has a confidence of {}".format(
                    selection_mark.state,
                    format_polygon(selection_mark.polygon),
                    selection_mark.confidence,
                )
            )

    for table_idx, table in enumerate(result.tables):
        print(
            "Table # {} has {} rows and {} columns".format(
                table_idx, table.row_count, table.column_count
            )
        )
        for region in table.bounding_regions:
            print(
                "Table # {} location on page: {} is {}".format(
                    table_idx,
                    region.page_number,
                    format_polygon(region.polygon),
                )
            )
        for cell in table.cells:
            print(
                "...Cell[{}][{}] has content '{}'".format(
                    cell.row_index,
                    cell.column_index,
                    cell.content,
                )
            )
            for region in cell.bounding_regions:
                print(
                    "...content on page {} is within bounding polygon '{}'".format(
                        region.page_number,
                        format_polygon(region.polygon),
                    )
                )

    print("----------------------------------------")


if __name__ == "__main__":
    analyze_layout()