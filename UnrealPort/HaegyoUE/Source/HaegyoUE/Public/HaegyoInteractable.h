#pragma once
#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "HaegyoInteractable.generated.h"

// 조사 · 문 · 사물함 · 장치 공통 인터페이스 (웹 게임의 findInteract / useProp 에 해당)
UINTERFACE(MinimalAPI, Blueprintable)
class UHaegyoInteractable : public UInterface
{
	GENERATED_BODY()
};

class HAEGYOUE_API IHaegyoInteractable
{
	GENERATED_BODY()
public:
	UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "Haegyo")
	void Interact(AActor* InstigatorActor);

	UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "Haegyo")
	FText GetPrompt() const;
};
